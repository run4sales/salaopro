DO $$
DECLARE
  v_employee record;
  v_manager record;
  v_claims text := current_setting('request.jwt.claims', true);
BEGIN
  SELECT eu.user_id, eu.establishment_id, eu.professional_id INTO v_employee
  FROM public.establishment_users eu
  JOIN public.professionals p ON p.id = eu.professional_id AND p.establishment_id = eu.establishment_id
  WHERE eu.active AND eu.role = 'employee'
    AND NOT public.is_establishment_admin(eu.establishment_id, eu.user_id)
  LIMIT 1;
  IF FOUND THEN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_employee.user_id, 'role', 'authenticated')::text, true);
    IF NOT public.can_manage_appointment_block(v_employee.establishment_id, v_employee.professional_id) THEN
      RAISE EXCEPTION 'Employee own professional authorization regression';
    END IF;
    IF public.can_manage_appointment_block(v_employee.establishment_id, '00000000-0000-0000-0000-000000000000'::uuid)
       OR public.can_manage_appointment_block('00000000-0000-0000-0000-000000000000'::uuid, v_employee.professional_id) THEN
      RAISE EXCEPTION 'Employee cross-professional or cross-tenant authorization regression';
    END IF;
  ELSE
    RAISE EXCEPTION 'No employee fixture available for block authorization verification';
  END IF;
  SELECT id, user_id INTO v_manager FROM public.profiles LIMIT 1;
  IF FOUND THEN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_manager.user_id, 'role', 'authenticated')::text, true);
    IF NOT public.can_manage_appointment_block(v_manager.id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      RAISE EXCEPTION 'Owner block authorization regression';
    END IF;
  END IF;
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF public.can_manage_appointment_block(v_employee.establishment_id, v_employee.professional_id) THEN
    RAISE EXCEPTION 'Anonymous block authorization regression';
  END IF;
  PERFORM set_config('request.jwt.claims', COALESCE(v_claims, ''), true);
END;
$$;