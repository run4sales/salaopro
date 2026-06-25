
-- 1. Restrict staff on card_machines and card_machine_fees to SELECT only
DROP POLICY IF EXISTS "Staff can access establishment data" ON public.card_machines;
DROP POLICY IF EXISTS "Staff can access establishment data" ON public.card_machine_fees;

CREATE POLICY "Staff can view card machines"
ON public.card_machines
FOR SELECT
TO authenticated
USING (public.is_establishment_member(establishment_id, auth.uid()));

CREATE POLICY "Staff can view card machine fees"
ON public.card_machine_fees
FOR SELECT
TO authenticated
USING (public.is_establishment_member(establishment_id, auth.uid()));

-- 2. Grant operational write access for staff on comandas and comanda_items
CREATE POLICY "Staff can insert comandas"
ON public.comandas
FOR INSERT
TO authenticated
WITH CHECK (public.is_establishment_member(establishment_id, auth.uid()));

CREATE POLICY "Staff can update comandas"
ON public.comandas
FOR UPDATE
TO authenticated
USING (public.is_establishment_member(establishment_id, auth.uid()))
WITH CHECK (public.is_establishment_member(establishment_id, auth.uid()));

CREATE POLICY "Staff can delete comandas"
ON public.comandas
FOR DELETE
TO authenticated
USING (public.is_establishment_member(establishment_id, auth.uid()));

CREATE POLICY "Staff can insert comanda_items"
ON public.comanda_items
FOR INSERT
TO authenticated
WITH CHECK (public.is_establishment_member(establishment_id, auth.uid()));

CREATE POLICY "Staff can update comanda_items"
ON public.comanda_items
FOR UPDATE
TO authenticated
USING (public.is_establishment_member(establishment_id, auth.uid()))
WITH CHECK (public.is_establishment_member(establishment_id, auth.uid()));

CREATE POLICY "Staff can delete comanda_items"
ON public.comanda_items
FOR DELETE
TO authenticated
USING (public.is_establishment_member(establishment_id, auth.uid()));

-- 3. Hard guard: prevent any staff (non-owner) from writing to their own membership row
-- Restrictive policy ensures that for any write on establishment_users, the caller
-- MUST be the owner of that establishment (profiles.user_id = auth.uid()) OR a super_admin.
CREATE POLICY "Restrict membership writes to owners or super admins"
ON public.establishment_users
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);
