-- Restore the exact RPC contract used by Contas a Pagar.  Some environments
-- received the create_payables repair without receiving pay_expense, leaving
-- PostgREST with no matching function in its schema cache.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fine NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest NUMERIC(12,2) NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.pay_expense(UUID, DATE, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE FUNCTION public.pay_expense(
  p_id UUID,
  p_payment_date DATE,
  p_amount NUMERIC,
  p_method TEXT,
  p_account TEXT,
  p_interest NUMERIC DEFAULT 0,
  p_fine NUMERIC DEFAULT 0,
  p_discount NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expense_before public.expenses%ROWTYPE;
  expense_after public.expenses%ROWTYPE;
  payment_id UUID;
  interest_amount NUMERIC := COALESCE(p_interest, 0);
  fine_amount NUMERIC := COALESCE(p_fine, 0);
  discount_amount NUMERIC := COALESCE(p_discount, 0);
BEGIN
  SELECT * INTO expense_before
  FROM public.expenses
  WHERE id = p_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;
  PERFORM public.assert_payable_manager(expense_before.establishment_id);

  IF p_payment_date IS NULL OR NULLIF(trim(p_method), '') IS NULL OR NULLIF(trim(p_account), '') IS NULL THEN
    RAISE EXCEPTION 'Data, forma de pagamento e conta financeira são obrigatórias';
  END IF;
  IF expense_before.status = 'cancelled' OR p_amount IS NULL OR p_amount <= 0
     OR expense_before.paid_amount + p_amount > expense_before.amount
     OR interest_amount < 0 OR fine_amount < 0 OR discount_amount < 0
     OR p_amount + interest_amount + fine_amount - discount_amount < 0 THEN
    RAISE EXCEPTION 'Pagamento inválido ou superior ao saldo';
  END IF;

  INSERT INTO public.expense_payments (
    expense_id, establishment_id, payment_date, amount, interest, fine,
    discount, payment_method, financial_account, notes
  ) VALUES (
    p_id, expense_before.establishment_id, p_payment_date, p_amount,
    interest_amount, fine_amount, discount_amount, p_method, p_account, p_notes
  ) RETURNING id INTO payment_id;

  UPDATE public.expenses
  SET paid_amount = paid_amount + p_amount,
      status = CASE WHEN paid_amount + p_amount >= amount THEN 'paid' ELSE 'partially_paid' END,
      paid_at = CASE WHEN paid_amount + p_amount >= amount THEN p_payment_date::TIMESTAMPTZ ELSE paid_at END,
      paid_by = auth.uid(),
      payment_date = p_payment_date,
      payment_method = p_method,
      discount = discount_amount,
      fine = fine_amount,
      interest = interest_amount,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO expense_after;

  INSERT INTO public.cash_flow_entries (
    establishment_id, entry_type, category, description, amount,
    payment_method, status, entry_date, source, source_id, notes
  ) VALUES (
    expense_before.establishment_id, 'expense', COALESCE(expense_before.category, 'Despesa'),
    expense_before.description, p_amount + interest_amount + fine_amount - discount_amount,
    p_method, 'confirmed', p_payment_date::TIMESTAMPTZ, 'expense_payment', payment_id, p_notes
  );

  INSERT INTO public.expense_audit_logs (
    expense_id, establishment_id, operation, old_values, new_values
  ) VALUES (
    p_id, expense_before.establishment_id, 'payment', to_jsonb(expense_before),
    jsonb_build_object('payment_id', payment_id, 'expense', to_jsonb(expense_after))
  );

  RETURN expense_after;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_expense(UUID, DATE, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_expense(UUID, DATE, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
