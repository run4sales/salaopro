DROP POLICY IF EXISTS appointment_blocks_establishment_access ON public.appointment_blocks;

CREATE POLICY appointment_blocks_establishment_access
ON public.appointment_blocks
FOR ALL
TO authenticated
USING (
  public.is_establishment_admin(establishment_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.establishment_users eu
    WHERE eu.establishment_id = appointment_blocks.establishment_id
      AND eu.user_id = auth.uid()
      AND eu.active = true
      AND eu.role = 'employee'
      AND eu.professional_id = appointment_blocks.professional_id
  )
)
WITH CHECK (
  public.is_establishment_admin(establishment_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.establishment_users eu
    WHERE eu.establishment_id = appointment_blocks.establishment_id
      AND eu.user_id = auth.uid()
      AND eu.active = true
      AND eu.role = 'employee'
      AND eu.professional_id = appointment_blocks.professional_id
  )
);