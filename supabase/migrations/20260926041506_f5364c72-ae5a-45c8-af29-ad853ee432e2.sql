CREATE OR REPLACE FUNCTION public.guard_absolute_appointment_blocks() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_start timestamptz; v_end timestamptz; v_establishment uuid; v_appointment uuid; v_professional uuid;
BEGIN
  IF TG_TABLE_NAME = 'appointments' THEN
    IF NEW.status IN ('canceled','cancelled','completed') THEN RETURN NEW; END IF;
    IF NEW.appointment_date IS NULL OR NEW.duration_minutes IS NULL OR NEW.duration_minutes <= 0 THEN RAISE EXCEPTION 'Informe horário e duração válidos'; END IF;
    v_start := NEW.appointment_date; v_end := v_start + make_interval(mins => NEW.duration_minutes);
    v_establishment := NEW.establishment_id; v_appointment := NEW.id;
    FOR v_professional IN SELECT DISTINCT pid FROM (
      SELECT NEW.professional_id AS pid
      UNION ALL
      SELECT ap.professional_id FROM public.appointment_professionals ap WHERE ap.appointment_id = NEW.id AND ap.establishment_id = NEW.establishment_id
    ) assigned WHERE pid IS NOT NULL ORDER BY pid LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended(v_establishment::text || ':' || v_professional::text, 0));
      IF EXISTS (SELECT 1 FROM public.appointment_blocks b WHERE b.establishment_id = v_establishment AND b.professional_id = v_professional AND b.start_time < v_end AND b.end_time > v_start) THEN
        RAISE EXCEPTION 'Horário bloqueado para este profissional';
      END IF;
    END LOOP;
  ELSE
    SELECT a.appointment_date, a.appointment_date + make_interval(mins => COALESCE(a.duration_minutes,30)), a.establishment_id, a.id INTO v_start,v_end,v_establishment,v_appointment
    FROM public.appointments a WHERE a.id = NEW.appointment_id AND a.establishment_id = NEW.establishment_id AND a.status NOT IN ('canceled','cancelled','completed');
    IF v_appointment IS NULL THEN RETURN NEW; END IF;
    v_professional := NEW.professional_id;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_establishment::text || ':' || v_professional::text, 0));
    IF EXISTS (SELECT 1 FROM public.appointment_blocks b WHERE b.establishment_id = v_establishment AND b.professional_id = v_professional AND b.start_time < v_end AND b.end_time > v_start) THEN
      RAISE EXCEPTION 'Horário bloqueado para este profissional';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_absolute_appointment_blocks() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_absolute_appointment_blocks BEFORE INSERT OR UPDATE OF appointment_date, duration_minutes, professional_id, status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.guard_absolute_appointment_blocks();
CREATE TRIGGER guard_absolute_appointment_professional_blocks BEFORE INSERT OR UPDATE OF professional_id, appointment_id ON public.appointment_professionals FOR EACH ROW EXECUTE FUNCTION public.guard_absolute_appointment_blocks();