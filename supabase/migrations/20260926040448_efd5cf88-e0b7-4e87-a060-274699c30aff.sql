CREATE OR REPLACE FUNCTION public.guard_agenda_employee_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role text; v_professional uuid; v_establishment uuid; v_appointment uuid; v_comanda uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN RETURN COALESCE(NEW, OLD); END IF;
  v_establishment := CASE WHEN TG_OP = 'DELETE' THEN OLD.establishment_id ELSE NEW.establishment_id END;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_establishment AND user_id = auth.uid()) THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT role, professional_id INTO v_role, v_professional FROM public.establishment_users
  WHERE establishment_id = v_establishment AND user_id = auth.uid() AND active LIMIT 1;
  IF v_role = 'admin' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF v_role IS DISTINCT FROM 'employee' OR v_professional IS NULL THEN RAISE EXCEPTION 'Ação não permitida para este colaborador'; END IF;
  IF TG_TABLE_NAME = 'appointment_blocks' THEN
    IF (TG_OP = 'DELETE' AND OLD.professional_id <> v_professional) OR (TG_OP <> 'DELETE' AND NEW.professional_id <> v_professional)
      THEN RAISE EXCEPTION 'Bloqueio de outro profissional não permitido'; END IF;
  ELSIF TG_TABLE_NAME = 'appointments' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.professional_id IS DISTINCT FROM v_professional THEN RAISE EXCEPTION 'Agendamento de outro profissional não permitido'; END IF;
    ELSIF NOT public.staff_owns_appointment(OLD.id, v_establishment) OR (TG_OP = 'UPDATE' AND NEW.professional_id IS DISTINCT FROM v_professional) THEN
      RAISE EXCEPTION 'Agendamento de outro profissional não permitido';
    END IF;
  ELSIF TG_TABLE_NAME = 'comandas' THEN
    v_appointment := CASE WHEN TG_OP = 'DELETE' THEN OLD.appointment_id ELSE NEW.appointment_id END;
    IF v_appointment IS NOT NULL AND NOT public.staff_owns_appointment(v_appointment, v_establishment) THEN RAISE EXCEPTION 'Comanda de outro profissional não permitida'; END IF;
  ELSIF TG_TABLE_NAME = 'comanda_items' THEN
    v_comanda := CASE WHEN TG_OP = 'DELETE' THEN OLD.comanda_id ELSE NEW.comanda_id END;
    IF EXISTS (SELECT 1 FROM public.comandas WHERE id = v_comanda AND establishment_id = v_establishment AND appointment_id IS NOT NULL)
      AND NOT public.staff_owns_comanda(v_comanda, v_establishment) THEN RAISE EXCEPTION 'Itens de outra comanda não permitidos'; END IF;
  ELSIF TG_TABLE_NAME = 'sales' THEN
    IF NEW.appointment_id IS NOT NULL AND NOT public.staff_owns_appointment(NEW.appointment_id, v_establishment)
      THEN RAISE EXCEPTION 'Venda fora dos próprios atendimentos não permitida'; END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.guard_agenda_employee_write() FROM PUBLIC, anon, authenticated;