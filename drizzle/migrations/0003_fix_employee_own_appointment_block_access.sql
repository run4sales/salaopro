CREATE OR REPLACE FUNCTION public.can_manage_appointment_block(p_establishment uuid, p_professional uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_establishment_admin(p_establishment, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.establishment_users eu
      JOIN public.professionals p ON p.id = eu.professional_id AND p.establishment_id = eu.establishment_id
      WHERE eu.user_id = auth.uid()
        AND eu.establishment_id = p_establishment
        AND eu.professional_id = p_professional
        AND eu.role = 'employee'
        AND eu.active = true
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_appointment_block(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_appointment_block(uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.can_manage_appointment_block(uuid, uuid) IS 'Checks the authenticated manager or active employee own professional without membership SELECT RLS masking the authorization lookup.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_blocks TO authenticated;
GRANT ALL ON public.appointment_blocks TO service_role;
ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;
ALTER POLICY appointment_blocks_establishment_access ON public.appointment_blocks
USING (public.can_manage_appointment_block(establishment_id, professional_id))
WITH CHECK (public.can_manage_appointment_block(establishment_id, professional_id));