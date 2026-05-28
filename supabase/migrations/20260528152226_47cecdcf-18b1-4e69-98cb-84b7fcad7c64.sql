
-- Goals: add explicit WITH CHECK
DROP POLICY IF EXISTS "Establishments can manage their goals" ON public.goals;
CREATE POLICY "Establishments can manage their goals"
ON public.goals
FOR ALL
USING (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Sales: add explicit WITH CHECK
DROP POLICY IF EXISTS "Establishments can manage their sales" ON public.sales;
CREATE POLICY "Establishments can manage their sales"
ON public.sales
FOR ALL
USING (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Services: add explicit WITH CHECK
DROP POLICY IF EXISTS "Establishments can manage their services" ON public.services;
CREATE POLICY "Establishments can manage their services"
ON public.services
FOR ALL
USING (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));

-- user_roles: restrictive policy blocking any non-super_admin write
CREATE POLICY "Only super admins can write roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
