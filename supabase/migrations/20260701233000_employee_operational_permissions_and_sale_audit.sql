-- Allow employees to perform operational tasks without granting administrative access.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_created_by_user_id ON public.sales(created_by_user_id);

-- Employees can create appointments for the establishment. Existing SELECT policies/RPCs still
-- restrict what an employee sees in the agenda to their linked professional.
DROP POLICY IF EXISTS "Staff can create establishment appointments" ON public.appointments;
CREATE POLICY "Staff can create establishment appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (
    establishment_id = public.current_establishment_id()
    AND public.current_establishment_role() IN ('owner', 'admin', 'employee')
  );

DROP POLICY IF EXISTS "Staff can create appointment_services" ON public.appointment_services;
CREATE POLICY "Staff can create appointment_services"
  ON public.appointment_services FOR INSERT TO authenticated
  WITH CHECK (
    establishment_id = public.current_establishment_id()
    AND public.current_establishment_role() IN ('owner', 'admin', 'employee')
  );

DROP POLICY IF EXISTS "Staff can create appointment_professionals" ON public.appointment_professionals;
CREATE POLICY "Staff can create appointment_professionals"
  ON public.appointment_professionals FOR INSERT TO authenticated
  WITH CHECK (
    establishment_id = public.current_establishment_id()
    AND public.current_establishment_role() IN ('owner', 'admin', 'employee')
  );

-- PDV dependencies: employees can read the active payment setup needed to complete a sale.
DROP POLICY IF EXISTS "Staff can view card machines" ON public.card_machines;
CREATE POLICY "Staff can view card machines"
  ON public.card_machines FOR SELECT TO authenticated
  USING (public.is_establishment_member(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Staff can view card machine fees" ON public.card_machine_fees;
CREATE POLICY "Staff can view card machine fees"
  ON public.card_machine_fees FOR SELECT TO authenticated
  USING (public.is_establishment_member(establishment_id, auth.uid()));

-- Employees can launch sales for the establishment even when the sold professional differs
-- from the authenticated employee. The created_by_user_id audit field must always be the
-- authenticated user for direct client inserts.
DROP POLICY IF EXISTS "Staff can create establishment sales" ON public.sales;
CREATE POLICY "Staff can create establishment sales"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    establishment_id = public.current_establishment_id()
    AND public.current_establishment_role() IN ('owner', 'admin', 'employee')
    AND created_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Staff can create sale_professionals" ON public.sale_professionals;
CREATE POLICY "Staff can create sale_professionals"
  ON public.sale_professionals FOR INSERT TO authenticated
  WITH CHECK (
    establishment_id = public.current_establishment_id()
    AND public.current_establishment_role() IN ('owner', 'admin', 'employee')
  );
