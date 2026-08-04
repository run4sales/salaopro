-- 1. Columns
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_paid_amount_check;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS supplier TEXT,
  ADD COLUMN IF NOT EXISTS cost_center TEXT,
  ADD COLUMN IF NOT EXISTS competence_date DATE,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installment_group_id UUID,
  ADD COLUMN IF NOT EXISTS installment_number INTEGER,
  ADD COLUMN IF NOT EXISTS installment_count INTEGER,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

UPDATE public.expenses
   SET due_date = COALESCE(due_date, expense_date::date),
       competence_date = COALESCE(competence_date, expense_date::date),
       paid_amount = CASE WHEN status = 'confirmed' THEN amount ELSE paid_amount END,
       paid_at = CASE WHEN status = 'confirmed' THEN COALESCE(paid_at, expense_date) ELSE paid_at END,
       status = CASE WHEN status = 'confirmed' THEN 'paid' ELSE status END;

ALTER TABLE public.expenses ALTER COLUMN due_date SET NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN due_date SET DEFAULT CURRENT_DATE;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_status_check
  CHECK (status IN ('pending','due_today','overdue','partially_paid','paid','cancelled'));
ALTER TABLE public.expenses ADD CONSTRAINT expenses_paid_amount_check
  CHECK (paid_amount >= 0 AND paid_amount <= amount);

-- 2. Payments + audit tables
CREATE TABLE IF NOT EXISTS public.expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  interest NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (interest >= 0),
  fine NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (fine >= 0),
  discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  final_amount NUMERIC(12,2) GENERATED ALWAYS AS (amount + interest + fine - discount) STORED,
  payment_method TEXT,
  financial_account TEXT,
  notes TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.expense_payments TO authenticated;
GRANT ALL ON public.expense_payments TO service_role;
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant reads expense payments" ON public.expense_payments;
CREATE POLICY "Tenant reads expense payments" ON public.expense_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = establishment_id AND p.user_id = auth.uid())
         OR public.is_establishment_member(establishment_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.expense_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID DEFAULT auth.uid(),
  operation TEXT NOT NULL CHECK (operation IN ('create','update','payment','delete','cancel')),
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.expense_audit_logs TO authenticated;
GRANT ALL ON public.expense_audit_logs TO service_role;
ALTER TABLE public.expense_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant reads expense audit" ON public.expense_audit_logs;
CREATE POLICY "Tenant reads expense audit" ON public.expense_audit_logs FOR SELECT TO authenticated
  USING (public.is_establishment_admin(establishment_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_expenses_payable_filters ON public.expenses(establishment_id, due_date, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_payments_expense ON public.expense_payments(expense_id, payment_date);

-- 3. Status refresh trigger
CREATE OR REPLACE FUNCTION public.refresh_expense_status() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.status := CASE
    WHEN NEW.status = 'cancelled' OR NEW.cancelled_at IS NOT NULL THEN 'cancelled'
    WHEN NEW.paid_amount >= NEW.amount THEN 'paid'
    WHEN NEW.paid_amount > 0 THEN 'partially_paid'
    WHEN NEW.due_date < CURRENT_DATE THEN 'overdue'
    WHEN NEW.due_date = CURRENT_DATE THEN 'due_today'
    ELSE 'pending' END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS refresh_expense_status_trigger ON public.expenses;
CREATE TRIGGER refresh_expense_status_trigger
BEFORE INSERT OR UPDATE OF amount, paid_amount, due_date, status, cancelled_at ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.refresh_expense_status();

-- 4. Cash flow stays in sync with expense status (no double entries)
CREATE OR REPLACE FUNCTION public.sync_expense_to_cash_flow() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.cash_flow_entries WHERE source = 'expense' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cash_flow_entries (
      establishment_id, entry_type, category, description, amount,
      payment_method, status, entry_date, source, source_id, notes
    ) VALUES (
      NEW.establishment_id, 'expense', COALESCE(NEW.category, 'Despesa'),
      NEW.description, NEW.amount, NULL,
      CASE WHEN NEW.status = 'paid' THEN 'confirmed' ELSE 'pending' END,
      COALESCE(NEW.due_date::timestamptz, NEW.expense_date), 'expense', NEW.id, NEW.notes
    );
  ELSE
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      DELETE FROM public.cash_flow_entries WHERE source = 'expense' AND source_id = NEW.id;
      RETURN NEW;
    END IF;
    UPDATE public.cash_flow_entries SET
      establishment_id = NEW.establishment_id,
      category = COALESCE(NEW.category, 'Despesa'),
      description = NEW.description,
      status = CASE WHEN NEW.status = 'paid' THEN 'confirmed' ELSE 'pending' END,
      entry_date = COALESCE(NEW.paid_at, NEW.due_date::timestamptz, NEW.expense_date),
      notes = NEW.notes,
      updated_at = now()
    WHERE source = 'expense' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

-- 5. Permission helper
CREATE OR REPLACE FUNCTION public.assert_payable_manager(p_establishment UUID) RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_establishment_admin(p_establishment, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para alterar contas a pagar';
  END IF;
END $$;

-- 6. Canonical RPCs (drop every legacy overload first)
DO $do$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('pay_expense','create_payables','update_payable','delete_payable')
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END $do$;

CREATE FUNCTION public.create_payables(p_establishment UUID, p_data JSONB, p_installments INTEGER DEFAULT 1)
RETURNS SETOF public.expenses LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n INTEGER := GREATEST(COALESCE(p_installments, 1), 1);
  total NUMERIC := COALESCE((p_data->>'amount')::numeric, 0);
  per NUMERIC;
  base_due DATE := COALESCE((p_data->>'due_date')::date, CURRENT_DATE);
  base_comp DATE := COALESCE((p_data->>'competence_date')::date, base_due);
  grp UUID := gen_random_uuid();
  i INTEGER;
  row_out public.expenses;
BEGIN
  PERFORM public.assert_payable_manager(p_establishment);
  IF total <= 0 THEN RAISE EXCEPTION 'Informe um valor maior que zero'; END IF;
  IF COALESCE(NULLIF(TRIM(p_data->>'description'), ''), '') = '' THEN RAISE EXCEPTION 'Informe a descrição da despesa'; END IF;
  per := ROUND(total / n, 2);

  FOR i IN 1..n LOOP
    INSERT INTO public.expenses (
      establishment_id, description, amount, category, supplier, cost_center, notes,
      due_date, competence_date, expense_date, status, paid_amount,
      installment_group_id, installment_number, installment_count, created_by
    ) VALUES (
      p_establishment,
      p_data->>'description',
      CASE WHEN i = n THEN total - per * (n - 1) ELSE per END,
      NULLIF(p_data->>'category', ''),
      NULLIF(p_data->>'supplier', ''),
      NULLIF(p_data->>'cost_center', ''),
      NULLIF(p_data->>'notes', ''),
      (base_due + make_interval(months => i - 1))::date,
      (base_comp + make_interval(months => i - 1))::date,
      (base_due + make_interval(months => i - 1))::timestamptz,
      'pending', 0,
      CASE WHEN n > 1 THEN grp ELSE NULL END,
      CASE WHEN n > 1 THEN i ELSE NULL END,
      CASE WHEN n > 1 THEN n ELSE NULL END,
      auth.uid()
    ) RETURNING * INTO row_out;

    INSERT INTO public.expense_audit_logs (expense_id, establishment_id, operation, new_values)
    VALUES (row_out.id, p_establishment, 'create', to_jsonb(row_out));

    RETURN NEXT row_out;
  END LOOP;
END $$;

CREATE FUNCTION public.update_payable(p_id UUID, p_changes JSONB)
RETURNS public.expenses LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_row public.expenses; new_row public.expenses;
BEGIN
  SELECT * INTO old_row FROM public.expenses WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;
  PERFORM public.assert_payable_manager(old_row.establishment_id);

  UPDATE public.expenses SET
    description = COALESCE(NULLIF(p_changes->>'description',''), description),
    supplier = COALESCE(NULLIF(p_changes->>'supplier',''), supplier),
    category = COALESCE(NULLIF(p_changes->>'category',''), category),
    cost_center = COALESCE(NULLIF(p_changes->>'cost_center',''), cost_center),
    notes = COALESCE(p_changes->>'notes', notes),
    amount = COALESCE((NULLIF(p_changes->>'amount',''))::numeric, amount),
    due_date = COALESCE((NULLIF(p_changes->>'due_date',''))::date, due_date),
    competence_date = COALESCE((NULLIF(p_changes->>'competence_date',''))::date, competence_date),
    expense_date = COALESCE((NULLIF(p_changes->>'due_date',''))::timestamptz, expense_date),
    updated_at = now()
  WHERE id = p_id RETURNING * INTO new_row;

  INSERT INTO public.expense_audit_logs (expense_id, establishment_id, operation, old_values, new_values)
  VALUES (p_id, old_row.establishment_id, 'update', to_jsonb(old_row), to_jsonb(new_row));
  RETURN new_row;
END $$;

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
) RETURNS public.expenses LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  expense_before public.expenses;
  expense_after public.expenses;
  interest_amount NUMERIC := COALESCE(p_interest, 0);
  fine_amount NUMERIC := COALESCE(p_fine, 0);
  discount_amount NUMERIC := COALESCE(p_discount, 0);
  effective_amount NUMERIC;
  payment_id UUID;
BEGIN
  SELECT * INTO expense_before FROM public.expenses WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;
  PERFORM public.assert_payable_manager(expense_before.establishment_id);

  IF expense_before.status = 'cancelled' THEN RAISE EXCEPTION 'Despesa cancelada não pode ser paga'; END IF;
  IF expense_before.status = 'paid' OR expense_before.paid_amount >= expense_before.amount THEN
    RAISE EXCEPTION 'Despesa já está paga';
  END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Informe um valor de pagamento maior que zero'; END IF;

  effective_amount := p_amount + interest_amount + fine_amount - discount_amount;

  INSERT INTO public.expense_payments (
    expense_id, establishment_id, payment_date, amount, interest, fine,
    discount, payment_method, financial_account, notes
  ) VALUES (
    p_id, expense_before.establishment_id, COALESCE(p_payment_date, CURRENT_DATE),
    p_amount, interest_amount, fine_amount, discount_amount, p_method, p_account, p_notes
  ) RETURNING id INTO payment_id;

  UPDATE public.expenses
     SET paid_amount = amount,
         status = 'paid',
         paid_at = COALESCE(p_payment_date, CURRENT_DATE)::timestamptz,
         paid_by = auth.uid(),
         updated_at = now()
   WHERE id = p_id
  RETURNING * INTO expense_after;

  UPDATE public.cash_flow_entries
     SET amount = effective_amount,
         payment_method = p_method,
         status = 'confirmed',
         entry_date = COALESCE(p_payment_date, CURRENT_DATE)::timestamptz,
         updated_at = now()
   WHERE source = 'expense' AND source_id = p_id;

  INSERT INTO public.expense_audit_logs (expense_id, establishment_id, operation, old_values, new_values)
  VALUES (p_id, expense_before.establishment_id, 'payment', to_jsonb(expense_before),
          jsonb_build_object('payment_id', payment_id, 'effective_amount', effective_amount, 'expense', to_jsonb(expense_after)));

  RETURN expense_after;
END $$;

CREATE FUNCTION public.delete_payable(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.expenses;
BEGIN
  SELECT * INTO e FROM public.expenses WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;
  PERFORM public.assert_payable_manager(e.establishment_id);

  DELETE FROM public.cash_flow_entries WHERE source = 'expense' AND source_id = p_id;
  UPDATE public.expenses SET deleted_at = now(), updated_at = now() WHERE id = p_id;

  INSERT INTO public.expense_audit_logs (expense_id, establishment_id, operation, old_values)
  VALUES (p_id, e.establishment_id, 'delete', to_jsonb(e));
END $$;

REVOKE ALL ON FUNCTION public.create_payables(UUID, JSONB, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_payable(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_expense(UUID, DATE, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_payable(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payables(UUID, JSONB, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_payable(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_expense(UUID, DATE, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_payable(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';