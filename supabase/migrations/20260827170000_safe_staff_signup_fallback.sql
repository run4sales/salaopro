-- Transactional database half of the staff onboarding availability fallback.
-- Auth signup remains subject to the project's normal email/password controls.
CREATE OR REPLACE FUNCTION public.link_new_staff_user(
  p_establishment_id uuid,
  p_user_id uuid,
  p_email text,
  p_name text,
  p_role public.establishment_access_role,
  p_service_ids uuid[] DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_professional_id uuid;
  v_service_count integer;
BEGIN
  IF p_role NOT IN ('admin', 'employee') OR length(trim(p_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Dados inválidos';
  END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM profiles WHERE id=p_establishment_id AND user_id=auth.uid())
    OR EXISTS (SELECT 1 FROM establishment_users WHERE establishment_id=p_establishment_id AND user_id=auth.uid() AND role='admin' AND active)
  ) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  -- Bind exactly the identity returned by signUp; never adopt an arbitrary
  -- existing account merely because its email matches.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user_id AND lower(email)=lower(trim(p_email))) THEN
    RAISE EXCEPTION 'Identidade inválida';
  END IF;
  IF EXISTS (SELECT 1 FROM establishment_users WHERE user_id=p_user_id) THEN
    RAISE EXCEPTION 'Este usuário já possui vínculo';
  END IF;

  SELECT count(*) INTO v_service_count FROM services
  WHERE establishment_id=p_establishment_id AND id=ANY(coalesce(p_service_ids,'{}'));
  IF v_service_count <> cardinality(coalesce(p_service_ids,'{}')) THEN
    RAISE EXCEPTION 'Um ou mais serviços são inválidos';
  END IF;

  INSERT INTO professionals(establishment_id,name,active)
  VALUES(p_establishment_id,trim(p_name),true) RETURNING id INTO v_professional_id;
  INSERT INTO establishment_users(establishment_id,user_id,role,professional_id,active,email)
  VALUES(p_establishment_id,p_user_id,p_role,v_professional_id,true,lower(trim(p_email)));
  INSERT INTO service_professionals(establishment_id,service_id,professional_id)
  SELECT p_establishment_id,id,v_professional_id FROM services
  WHERE establishment_id=p_establishment_id AND id=ANY(coalesce(p_service_ids,'{}'));

  RETURN jsonb_build_object('user_id',p_user_id,'professional_id',v_professional_id);
END $$;

REVOKE ALL ON FUNCTION public.link_new_staff_user(uuid,uuid,text,text,public.establishment_access_role,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_new_staff_user(uuid,uuid,text,text,public.establishment_access_role,uuid[]) TO authenticated;
