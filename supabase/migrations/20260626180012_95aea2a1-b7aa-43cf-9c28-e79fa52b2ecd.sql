
DROP POLICY IF EXISTS "Staff can access establishment data" ON public.professionals;
CREATE POLICY "Staff can view professionals" ON public.professionals FOR SELECT TO authenticated USING (public.is_establishment_member(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Staff can access establishment data" ON public.service_professionals;
CREATE POLICY "Staff can view service_professionals" ON public.service_professionals FOR SELECT TO authenticated USING (public.is_establishment_member(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Staff can access establishment data" ON public.services;
CREATE POLICY "Staff can view services" ON public.services FOR SELECT TO authenticated USING (public.is_establishment_member(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Staff can access establishment data" ON public.settings;
CREATE POLICY "Staff can view settings" ON public.settings FOR SELECT TO authenticated USING (public.is_establishment_member(establishment_id, auth.uid()));
