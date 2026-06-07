
-- Fix settings ALL policy: add WITH CHECK and restrict to authenticated
DROP POLICY IF EXISTS "Establishments can manage their settings" ON public.settings;
CREATE POLICY "Establishments can manage their settings"
ON public.settings
FOR ALL
TO authenticated
USING (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Restrict subscriptions SELECT policy to authenticated
DROP POLICY IF EXISTS "Establishments can view their subscription" ON public.subscriptions;
CREATE POLICY "Establishments can view their subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));
