CREATE OR REPLACE FUNCTION public.staff_owns_appointment(p_appointment_id uuid, p_establishment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.establishment_users eu ON eu.establishment_id = a.establishment_id
    WHERE a.id = p_appointment_id AND a.establishment_id = p_establishment_id
      AND eu.user_id = auth.uid() AND eu.active AND eu.role = 'employee'
      AND eu.professional_id IS NOT NULL
      AND (a.professional_id = eu.professional_id OR EXISTS (
        SELECT 1 FROM public.appointment_professionals ap
        WHERE ap.appointment_id = a.id AND ap.establishment_id = a.establishment_id AND ap.professional_id = eu.professional_id
      ))
  );
$$;
REVOKE ALL ON FUNCTION public.staff_owns_appointment(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_owns_appointment(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_owns_comanda(p_comanda_id uuid, p_establishment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.comandas c WHERE c.id = p_comanda_id AND c.establishment_id = p_establishment_id
    AND c.appointment_id IS NOT NULL AND public.staff_owns_appointment(c.appointment_id, c.establishment_id));
$$;
REVOKE ALL ON FUNCTION public.staff_owns_comanda(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_owns_comanda(uuid,uuid) TO authenticated, service_role;

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
    IF v_appointment IS NULL OR NOT public.staff_owns_appointment(v_appointment, v_establishment) THEN RAISE EXCEPTION 'Comanda de outro profissional não permitida'; END IF;
  ELSIF TG_TABLE_NAME = 'comanda_items' THEN
    v_comanda := CASE WHEN TG_OP = 'DELETE' THEN OLD.comanda_id ELSE NEW.comanda_id END;
    IF NOT public.staff_owns_comanda(v_comanda, v_establishment) THEN RAISE EXCEPTION 'Itens de outra comanda não permitidos'; END IF;
  ELSIF TG_TABLE_NAME = 'sales' THEN
    IF NEW.appointment_id IS NULL OR NOT public.staff_owns_appointment(NEW.appointment_id, v_establishment)
      THEN RAISE EXCEPTION 'Venda fora dos próprios atendimentos não permitida'; END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.guard_agenda_employee_write() FROM PUBLIC;
CREATE TRIGGER guard_employee_appointments BEFORE INSERT OR UPDATE OR DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.guard_agenda_employee_write();
CREATE TRIGGER guard_employee_blocks BEFORE INSERT OR UPDATE OR DELETE ON public.appointment_blocks FOR EACH ROW EXECUTE FUNCTION public.guard_agenda_employee_write();
CREATE TRIGGER guard_employee_comandas BEFORE INSERT OR UPDATE OR DELETE ON public.comandas FOR EACH ROW EXECUTE FUNCTION public.guard_agenda_employee_write();
CREATE TRIGGER guard_employee_comanda_items BEFORE INSERT OR UPDATE OR DELETE ON public.comanda_items FOR EACH ROW EXECUTE FUNCTION public.guard_agenda_employee_write();
CREATE TRIGGER guard_employee_sales BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.guard_agenda_employee_write();

CREATE OR REPLACE FUNCTION public.guard_comanda_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.appointment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sales s WHERE s.appointment_id = NEW.appointment_id AND s.establishment_id = NEW.establishment_id AND s.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'Este agendamento já foi faturado'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('paid','canceled') AND (NEW.status, NEW.total, NEW.discount) IS DISTINCT FROM (OLD.status, OLD.total, OLD.discount)
    THEN RAISE EXCEPTION 'Comanda encerrada não pode ser faturada novamente'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_comanda_billing() FROM PUBLIC;
CREATE TRIGGER guard_comanda_billing BEFORE INSERT OR UPDATE ON public.comandas FOR EACH ROW EXECUTE FUNCTION public.guard_comanda_billing();
NOTIFY pgrst, 'reload schema';