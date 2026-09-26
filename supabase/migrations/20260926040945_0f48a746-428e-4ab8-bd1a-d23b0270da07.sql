CREATE OR REPLACE FUNCTION public.guard_staff_appointment_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_professional uuid; v_establishment uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN RETURN COALESCE(NEW,OLD); END IF;
  v_establishment := CASE WHEN TG_OP = 'DELETE' THEN OLD.establishment_id ELSE NEW.establishment_id END;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id = v_establishment AND user_id = auth.uid()) OR EXISTS(SELECT 1 FROM public.establishment_users WHERE establishment_id = v_establishment AND user_id = auth.uid() AND active AND role = 'admin') THEN RETURN COALESCE(NEW,OLD); END IF;
  SELECT professional_id INTO v_professional FROM public.establishment_users WHERE establishment_id = v_establishment AND user_id = auth.uid() AND active AND role = 'employee' LIMIT 1;
  IF v_professional IS NULL THEN RAISE EXCEPTION 'Ação não autorizada'; END IF;
  IF TG_TABLE_NAME = 'appointment_professionals' THEN
    IF (TG_OP = 'DELETE' AND OLD.professional_id <> v_professional) OR (TG_OP <> 'DELETE' AND NEW.professional_id <> v_professional) THEN RAISE EXCEPTION 'Profissional não vinculado à sua conta'; END IF;
    IF NOT public.staff_owns_appointment(COALESCE(NEW.appointment_id, OLD.appointment_id),v_establishment) THEN RAISE EXCEPTION 'Agendamento fora da sua agenda'; END IF;
  ELSIF TG_TABLE_NAME = 'appointment_services' THEN
    IF NOT public.staff_owns_appointment(COALESCE(NEW.appointment_id,OLD.appointment_id),v_establishment) THEN RAISE EXCEPTION 'Agendamento fora da sua agenda'; END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public.guard_staff_appointment_assignment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_staff_appointment_professionals BEFORE INSERT OR UPDATE OR DELETE ON public.appointment_professionals FOR EACH ROW EXECUTE FUNCTION public.guard_staff_appointment_assignment();
CREATE TRIGGER guard_staff_appointment_services BEFORE INSERT OR UPDATE OR DELETE ON public.appointment_services FOR EACH ROW EXECUTE FUNCTION public.guard_staff_appointment_assignment();

CREATE OR REPLACE FUNCTION public.guard_agenda_employee_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role text; v_professional uuid; v_establishment uuid; v_appointment uuid; v_comanda uuid; v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN RETURN COALESCE(NEW, OLD); END IF;
  v_establishment := CASE WHEN TG_OP = 'DELETE' THEN OLD.establishment_id ELSE NEW.establishment_id END;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_establishment AND user_id = auth.uid()) THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT role, professional_id INTO v_role, v_professional FROM public.establishment_users WHERE establishment_id = v_establishment AND user_id = auth.uid() AND active LIMIT 1;
  IF v_role = 'admin' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF v_role IS DISTINCT FROM 'employee' OR v_professional IS NULL THEN RAISE EXCEPTION 'Ação não permitida para este colaborador'; END IF;
  IF TG_TABLE_NAME = 'appointment_blocks' THEN
    IF (TG_OP = 'DELETE' AND OLD.professional_id <> v_professional) OR (TG_OP <> 'DELETE' AND NEW.professional_id <> v_professional) THEN RAISE EXCEPTION 'Bloqueio de outro profissional não permitido'; END IF;
  ELSIF TG_TABLE_NAME = 'appointments' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.professional_id IS DISTINCT FROM v_professional THEN RAISE EXCEPTION 'Agendamento de outro profissional não permitido'; END IF;
    ELSIF NOT public.staff_owns_appointment(OLD.id, v_establishment) OR (TG_OP = 'UPDATE' AND NEW.professional_id IS DISTINCT FROM v_professional) THEN RAISE EXCEPTION 'Agendamento de outro profissional não permitido'; END IF;
    IF TG_OP <> 'DELETE' AND NEW.status NOT IN ('canceled','cancelled','completed') THEN
      IF NEW.duration_minutes IS NULL OR NEW.duration_minutes <= 0 OR NEW.appointment_date IS NULL THEN RAISE EXCEPTION 'Informe horário e duração válidos'; END IF;
      PERFORM pg_advisory_xact_lock(hashtextextended(v_establishment::text || ':' || v_professional::text, 0));
      v_end := NEW.appointment_date + make_interval(mins => NEW.duration_minutes);
      IF EXISTS (SELECT 1 FROM public.appointment_blocks b WHERE b.establishment_id = v_establishment AND b.professional_id = v_professional AND b.start_time < v_end AND b.end_time > NEW.appointment_date) OR EXISTS (
        SELECT 1 FROM public.appointments a WHERE a.establishment_id = v_establishment AND a.id IS DISTINCT FROM NEW.id AND a.status NOT IN ('canceled','cancelled','completed') AND a.appointment_date < v_end AND a.appointment_date + make_interval(mins => COALESCE(a.duration_minutes,30)) > NEW.appointment_date AND (a.professional_id = v_professional OR EXISTS (SELECT 1 FROM public.appointment_professionals ap WHERE ap.appointment_id = a.id AND ap.establishment_id = v_establishment AND ap.professional_id = v_professional))
      ) THEN RAISE EXCEPTION 'Conflito de horário ou bloqueio para este profissional'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'comandas' THEN
    v_appointment := CASE WHEN TG_OP = 'DELETE' THEN OLD.appointment_id ELSE NEW.appointment_id END;
    IF v_appointment IS NOT NULL AND NOT public.staff_owns_appointment(v_appointment, v_establishment) THEN RAISE EXCEPTION 'Comanda de outro profissional não permitida'; END IF;
  ELSIF TG_TABLE_NAME = 'comanda_items' THEN
    v_comanda := CASE WHEN TG_OP = 'DELETE' THEN OLD.comanda_id ELSE NEW.comanda_id END;
    IF EXISTS (SELECT 1 FROM public.comandas WHERE id = v_comanda AND establishment_id = v_establishment AND appointment_id IS NOT NULL) AND NOT public.staff_owns_comanda(v_comanda,v_establishment) THEN RAISE EXCEPTION 'Itens de outra comanda não permitidos'; END IF;
  ELSIF TG_TABLE_NAME = 'sales' THEN
    IF NEW.appointment_id IS NOT NULL AND NOT public.staff_owns_appointment(NEW.appointment_id,v_establishment) THEN RAISE EXCEPTION 'Venda fora dos próprios atendimentos não permitida'; END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public.guard_agenda_employee_write() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_repeat_appointment_sale() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.appointment_id IS NULL OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('billing:' || NEW.establishment_id::text || ':' || NEW.appointment_id::text,0));
  IF EXISTS (SELECT 1 FROM public.sales s WHERE s.establishment_id = NEW.establishment_id AND s.appointment_id = NEW.appointment_id AND s.deleted_at IS NULL AND s.xmin::text <> txid_current()::text) THEN
    RAISE EXCEPTION 'Este agendamento já possui faturamento. Não é possível cobrar novamente';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_repeat_appointment_sale() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_repeat_appointment_sale BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.guard_repeat_appointment_sale();