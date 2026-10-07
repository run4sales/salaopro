CREATE OR REPLACE FUNCTION public.guard_duplicate_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('canceled', 'cancelled') THEN RETURN NEW; END IF;
  -- Serialize the same booking identity, without blocking different clients or
  -- legitimate adjacent bookings. Existing canceled history is never considered.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'appointment-identity:' || NEW.establishment_id::text || ':' || NEW.client_id::text || ':' || NEW.appointment_date::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.establishment_id = NEW.establishment_id
      AND a.client_id = NEW.client_id
      AND a.appointment_date = NEW.appointment_date
      AND a.service_id = NEW.service_id
      AND a.professional_id IS NOT DISTINCT FROM NEW.professional_id
      AND a.status IS DISTINCT FROM 'canceled'
      AND a.status IS DISTINCT FROM 'cancelled'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505',
      MESSAGE = 'Este atendimento já está agendado para o mesmo cliente, serviço, profissional e horário. Abra o agendamento existente.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_duplicate_appointment_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_duplicate_appointment_insert() TO service_role;
CREATE TRIGGER zz_guard_duplicate_appointment_insert
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_duplicate_appointment_insert();
COMMENT ON FUNCTION public.guard_duplicate_appointment_insert() IS 'Reject exact duplicate inserts under a transaction lock; preserve existing rows, canceled rebookings, and legitimate overrides for different clients.';