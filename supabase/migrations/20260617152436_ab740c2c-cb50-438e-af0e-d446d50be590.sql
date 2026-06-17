
DROP POLICY IF EXISTS "Staff can access establishment data" ON public.cash_flow_entries;
CREATE POLICY "Staff can view establishment cash flow" ON public.cash_flow_entries
  FOR SELECT USING (public.is_establishment_member(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Staff can access establishment data" ON public.expenses;
CREATE POLICY "Staff can view establishment expenses" ON public.expenses
  FOR SELECT USING (public.is_establishment_member(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Staff can access establishment data" ON public.goals;
CREATE POLICY "Staff can view establishment goals" ON public.goals
  FOR SELECT USING (public.is_establishment_member(establishment_id, auth.uid()));
