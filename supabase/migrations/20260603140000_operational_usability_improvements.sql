-- Operational improvements for services, clients and agenda.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_clients_active_establishment
  ON public.clients (establishment_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

CREATE INDEX IF NOT EXISTS idx_appointments_active_schedule
  ON public.appointments (establishment_id, appointment_date)
  WHERE coalesce(status, 'scheduled') <> 'canceled';

CREATE TABLE IF NOT EXISTS public.appointment_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_blocks_valid_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_appointment_blocks_professional_range
  ON public.appointment_blocks (establishment_id, professional_id, start_time, end_time);

ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointment_blocks'
      AND policyname = 'appointment_blocks_establishment_access'
  ) THEN
    CREATE POLICY appointment_blocks_establishment_access
      ON public.appointment_blocks
      FOR ALL
      USING (establishment_id = public.current_establishment_id())
      WITH CHECK (establishment_id = public.current_establishment_id());
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_appointment_blocks_updated_at ON public.appointment_blocks;
CREATE TRIGGER update_appointment_blocks_updated_at
  BEFORE UPDATE ON public.appointment_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
