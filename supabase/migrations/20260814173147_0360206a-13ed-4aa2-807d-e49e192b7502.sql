-- 1) Restrict staff inserts on client_credit_transactions
DROP POLICY IF EXISTS "Staff insert credit txns" ON public.client_credit_transactions;

CREATE POLICY "Staff insert operational credit txns"
ON public.client_credit_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_establishment_member(establishment_id, auth.uid())
  AND type IN ('credit', 'debit')
  AND amount > 0
  AND created_by = auth.uid()
  AND source IS NOT NULL
);

-- 2) Explicit write policies for expense_payments (owner/admin only)
DROP POLICY IF EXISTS "Admins insert expense payments" ON public.expense_payments;
DROP POLICY IF EXISTS "Admins update expense payments" ON public.expense_payments;
DROP POLICY IF EXISTS "Admins delete expense payments" ON public.expense_payments;

CREATE POLICY "Admins insert expense payments"
ON public.expense_payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = expense_payments.establishment_id AND p.user_id = auth.uid())
  OR public.is_establishment_admin(establishment_id, auth.uid())
);

CREATE POLICY "Admins update expense payments"
ON public.expense_payments
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = expense_payments.establishment_id AND p.user_id = auth.uid())
  OR public.is_establishment_admin(establishment_id, auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = expense_payments.establishment_id AND p.user_id = auth.uid())
  OR public.is_establishment_admin(establishment_id, auth.uid())
);

CREATE POLICY "Admins delete expense payments"
ON public.expense_payments
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = expense_payments.establishment_id AND p.user_id = auth.uid())
  OR public.is_establishment_admin(establishment_id, auth.uid())
);