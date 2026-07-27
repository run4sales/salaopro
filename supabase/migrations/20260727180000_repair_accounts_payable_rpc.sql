-- Repair the API contract after deployments where PostgREST did not expose create_payables.
-- The explicit drop removes a stale overload with the same argument names/types before recreation.
DROP FUNCTION IF EXISTS public.create_payables(UUID, JSONB, INTEGER);

CREATE FUNCTION public.create_payables(
  p_establishment UUID,
  p_data JSONB,
  p_installments INTEGER DEFAULT 1
)
RETURNS SETOF public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  installment_index INTEGER;
  installment_group UUID := CASE WHEN p_installments > 1 THEN gen_random_uuid() END;
  total_amount NUMERIC;
  installment_amount NUMERIC;
  installment_due_date DATE;
  created_expense public.expenses%ROWTYPE;
BEGIN
  PERFORM public.assert_payable_manager(p_establishment);

  IF p_installments IS NULL OR p_installments < 1 OR p_installments > 360 THEN
    RAISE EXCEPTION 'Quantidade de parcelas inválida';
  END IF;

  total_amount := NULLIF(p_data->>'amount', '')::NUMERIC;
  IF total_amount IS NULL OR total_amount <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;
  IF NULLIF(trim(p_data->>'description'), '') IS NULL THEN
    RAISE EXCEPTION 'Descrição obrigatória';
  END IF;

  installment_amount := round(total_amount / p_installments, 2);
  FOR installment_index IN 1..p_installments LOOP
    installment_due_date := (p_data->>'due_date')::DATE + make_interval(months => installment_index - 1);
    INSERT INTO public.expenses (
      establishment_id, description, amount, category, supplier, cost_center, notes,
      due_date, competence_date, expense_date, status, installment_group_id,
      installment_number, installment_count, created_by
    ) VALUES (
      p_establishment,
      CASE WHEN p_installments > 1 THEN (p_data->>'description') || ' (' || installment_index || '/' || p_installments || ')' ELSE p_data->>'description' END,
      CASE WHEN installment_index = p_installments THEN total_amount - installment_amount * (p_installments - 1) ELSE installment_amount END,
      NULLIF(p_data->>'category', ''), NULLIF(p_data->>'supplier', ''), NULLIF(p_data->>'cost_center', ''), NULLIF(p_data->>'notes', ''),
      installment_due_date, COALESCE(NULLIF(p_data->>'competence_date', '')::DATE, installment_due_date), installment_due_date::TIMESTAMPTZ,
      'pending', installment_group, installment_index, p_installments, auth.uid()
    ) RETURNING * INTO created_expense;

    INSERT INTO public.expense_audit_logs (expense_id, establishment_id, operation, new_values)
    VALUES (created_expense.id, p_establishment, 'create', to_jsonb(created_expense));
    RETURN NEXT created_expense;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.create_payables(UUID, JSONB, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payables(UUID, JSONB, INTEGER) TO authenticated;

-- Preserve all legacy rows and make the compatibility fields deterministic if a partial deploy occurred.
UPDATE public.expenses
SET due_date = COALESCE(due_date, expense_date::DATE),
    competence_date = COALESCE(competence_date, expense_date::DATE),
    paid_amount = COALESCE(paid_amount, CASE WHEN status IN ('paid', 'confirmed') THEN amount ELSE 0 END)
WHERE due_date IS NULL OR competence_date IS NULL OR paid_amount IS NULL;

NOTIFY pgrst, 'reload schema';
