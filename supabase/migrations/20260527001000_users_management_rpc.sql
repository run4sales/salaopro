CREATE OR REPLACE FUNCTION public.create_establishment_user(
  p_establishment_id uuid,
  p_email text,
  p_name text,
  p_role public.establishment_access_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_professional_id uuid;
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_establishment_id AND p.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.establishment_users eu
      WHERE eu.establishment_id = p_establishment_id
        AND eu.user_id = auth.uid()
        AND eu.role = 'admin'
        AND eu.active = true
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar usuários deste estabelecimento';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado. O colaborador precisa criar a conta primeiro com este e-mail.';
  END IF;

  INSERT INTO public.professionals (establishment_id, name, active)
  VALUES (p_establishment_id, p_name, true)
  RETURNING id INTO v_professional_id;

  INSERT INTO public.establishment_users (establishment_id, user_id, role, professional_id, active)
  VALUES (p_establishment_id, v_user_id, p_role, v_professional_id, true)
  ON CONFLICT (establishment_id, user_id)
  DO UPDATE SET role = excluded.role, professional_id = excluded.professional_id, active = true;

  RETURN jsonb_build_object('user_id', v_user_id, 'professional_id', v_professional_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_establishment_user(uuid, text, text, public.establishment_access_role) TO authenticated;
