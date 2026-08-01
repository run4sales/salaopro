-- Keep recurring payable generation compatible with the expanded accounts-payable schema.
CREATE OR REPLACE FUNCTION public.generate_financial_recurrence(p_recurrence_id UUID, p_until DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.financial_recurrences%ROWTYPE; occ DATE; generated INTEGER := 0; idx INTEGER := 0; stop_date DATE;
BEGIN
  SELECT * INTO r FROM public.financial_recurrences WHERE id = p_recurrence_id AND active FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  stop_date := LEAST(COALESCE(r.end_date, p_until), p_until); occ := r.start_date;
  WHILE occ <= stop_date LOOP
    idx := idx + 1;
    IF r.max_occurrences IS NOT NULL AND idx > r.max_occurrences THEN EXIT; END IF;
    IF r.tipo = 'payable' THEN
      INSERT INTO public.expenses (
        establishment_id, description, amount, category, supplier, cost_center, expense_date,
        due_date, competence_date, notes, status, recurring_plan_id, occurrence_date, created_by
      ) VALUES (
        r.tenant_id, r.template->>'description', (r.template->>'amount')::NUMERIC,
        r.template->>'category', NULLIF(r.template->>'supplier', ''), NULLIF(r.template->>'cost_center', ''),
        occ::TIMESTAMPTZ, occ, occ, r.template->>'notes', 'pending', r.id, occ, auth.uid()
      ) ON CONFLICT (recurring_plan_id, occurrence_date)
        WHERE recurring_plan_id IS NOT NULL AND deleted_at IS NULL DO NOTHING;
    ELSE
      INSERT INTO public.cash_flow_entries (
        establishment_id, entry_type, category, description, amount, payment_method,
        status, entry_date, source, notes, recurring_plan_id, occurrence_date
      ) VALUES (
        r.tenant_id, 'income', COALESCE(r.template->>'category', 'Receita recorrente'),
        r.template->>'description', (r.template->>'amount')::NUMERIC, r.template->>'payment_method',
        'pending', occ::TIMESTAMPTZ, 'recurrence', r.template->>'notes', r.id, occ
      ) ON CONFLICT (recurring_plan_id, occurrence_date)
        WHERE recurring_plan_id IS NOT NULL AND deleted_at IS NULL DO NOTHING;
    END IF;
    generated := generated + 1;
    occ := (occ::TIMESTAMP + public.financial_recurrence_step(r.frequency, r.interval_count))::DATE;
  END LOOP;
  UPDATE public.financial_recurrences SET last_generated_date = stop_date,
    active = CASE WHEN r.end_date IS NOT NULL AND stop_date >= r.end_date THEN false ELSE active END
  WHERE id = r.id;
  RETURN generated;
END;
$$;

-- Managers of the current establishment may create the same recurrence from Contas a Pagar.
CREATE OR REPLACE FUNCTION public.create_financial_recurrence(
  p_tenant_id UUID, p_tipo TEXT, p_frequency TEXT, p_start_date DATE,
  p_end_date DATE DEFAULT NULL, p_max_occurrences INTEGER DEFAULT NULL,
  p_template JSONB DEFAULT '{}'::JSONB, p_generate_until DATE DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recurrence_id UUID; generation_limit DATE;
BEGIN
  PERFORM public.assert_payable_manager(p_tenant_id);
  IF p_tipo NOT IN ('payable', 'receivable') THEN RAISE EXCEPTION 'Tipo de recorrência inválido'; END IF;
  IF p_end_date IS NOT NULL AND p_max_occurrences IS NOT NULL THEN
    RAISE EXCEPTION 'Informe data final ou quantidade de ocorrências, não ambos';
  END IF;
  INSERT INTO public.financial_recurrences (tenant_id, tipo, frequency, start_date, end_date, max_occurrences, template)
  VALUES (p_tenant_id, p_tipo, p_frequency, p_start_date, p_end_date, p_max_occurrences, p_template)
  RETURNING id INTO recurrence_id;
  generation_limit := COALESCE(p_generate_until, p_end_date,
    CASE WHEN p_max_occurrences IS NOT NULL THEN
      (p_start_date::TIMESTAMP + public.financial_recurrence_step(p_frequency, p_max_occurrences - 1))::DATE
    ELSE (CURRENT_DATE + INTERVAL '12 months')::DATE END);
  PERFORM public.generate_financial_recurrence(recurrence_id, generation_limit);
  RETURN recurrence_id;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_financial_recurrence(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_financial_recurrence(UUID, TEXT, TEXT, DATE, DATE, INTEGER, JSONB, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_financial_recurrence(UUID, TEXT, TEXT, DATE, DATE, INTEGER, JSONB, DATE) TO authenticated;
NOTIFY pgrst, 'reload schema';
