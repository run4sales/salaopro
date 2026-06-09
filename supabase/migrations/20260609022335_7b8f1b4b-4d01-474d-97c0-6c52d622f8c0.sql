
-- Helper: recreate "Establishments ..." owner policies restricted to authenticated with matching WITH CHECK

-- clients
DROP POLICY IF EXISTS "Establishments can manage their clients" ON public.clients;
CREATE POLICY "Establishments can manage their clients" ON public.clients
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- appointments
DROP POLICY IF EXISTS "Establishments can manage their appointments" ON public.appointments;
CREATE POLICY "Establishments can manage their appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- sales
DROP POLICY IF EXISTS "Establishments can manage their sales" ON public.sales;
CREATE POLICY "Establishments can manage their sales" ON public.sales
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- professionals
DROP POLICY IF EXISTS "Establishments can manage their professionals" ON public.professionals;
CREATE POLICY "Establishments can manage their professionals" ON public.professionals
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- services
DROP POLICY IF EXISTS "Establishments can manage their services" ON public.services;
CREATE POLICY "Establishments can manage their services" ON public.services
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- sale_professionals
DROP POLICY IF EXISTS "Establishments can manage their sale_professionals" ON public.sale_professionals;
CREATE POLICY "Establishments can manage their sale_professionals" ON public.sale_professionals
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- appointment_professionals
DROP POLICY IF EXISTS "Establishments manage appointment_professionals" ON public.appointment_professionals;
CREATE POLICY "Establishments manage appointment_professionals" ON public.appointment_professionals
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- appointment_services
DROP POLICY IF EXISTS "Establishments manage appointment_services" ON public.appointment_services;
CREATE POLICY "Establishments manage appointment_services" ON public.appointment_services
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- card_machines
DROP POLICY IF EXISTS "Establishments can manage their card machines" ON public.card_machines;
CREATE POLICY "Establishments can manage their card machines" ON public.card_machines
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- card_machine_fees
DROP POLICY IF EXISTS "Establishments can manage their card machine fees" ON public.card_machine_fees;
CREATE POLICY "Establishments can manage their card machine fees" ON public.card_machine_fees
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- expenses
DROP POLICY IF EXISTS "Establishments can manage their expenses" ON public.expenses;
CREATE POLICY "Establishments can manage their expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- goals
DROP POLICY IF EXISTS "Establishments can manage their goals" ON public.goals;
CREATE POLICY "Establishments can manage their goals" ON public.goals
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- service_professionals
DROP POLICY IF EXISTS "Establishments can manage their service_professionals" ON public.service_professionals;
CREATE POLICY "Establishments can manage their service_professionals" ON public.service_professionals
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- cash_flow_entries
DROP POLICY IF EXISTS "Establishments can manage their cash flow" ON public.cash_flow_entries;
CREATE POLICY "Establishments can manage their cash flow" ON public.cash_flow_entries
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- comandas
DROP POLICY IF EXISTS "Establishments manage their comandas" ON public.comandas;
CREATE POLICY "Establishments manage their comandas" ON public.comandas
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- comanda_items
DROP POLICY IF EXISTS "Establishments manage their comanda_items" ON public.comanda_items;
CREATE POLICY "Establishments manage their comanda_items" ON public.comanda_items
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- settings
DROP POLICY IF EXISTS "Establishments can manage their settings" ON public.settings;
CREATE POLICY "Establishments can manage their settings" ON public.settings
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
