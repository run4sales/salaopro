CREATE OR REPLACE FUNCTION public.generate_financial_recurrence(p_recurrence_id uuid, p_until date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.financial_recurrences%ROWTYPE;
  occ DATE;
  generated INTEGER := 0;
  idx INTEGER := 0;
  stop_date DATE;
  competence_offset INTEGER;
BEGIN
  SELECT * INTO r
  FROM public.financial_recurrences
  WHERE id = p_recurrence_id AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 0; END IF;

  stop_date := LEAST(COALESCE(r.end_date, p_until), p_until);
  occ := r.start_date;

  -- Difference (in days) between the competence informed by the user and the first due date.
  competence_offset := COALESCE(
    (NULLIF(r.template->>'competence_date', ''))::date - r.start_date, 0);

  WHILE occ <= stop_date LOOP
    idx := idx + 1;
    IF r.max_occurrences IS NOT NULL AND idx > r.max_occurrences THEN EXIT; END IF;

    IF r.tipo = 'payable' THEN
      INSERT INTO public.expenses (
        establishment_id, description, amount, category, expense_date, notes,
        status, recurring_plan_id, occurrence_date,
        due_date, competence_date, supplier, cost_center
      )
      VALUES (
        r.tenant_id, r.template->>'description', (r.template->>'amount')::numeric,
        r.template->>'category', occ::timestamptz, r.template->>'notes',
        'pending', r.id, occ,
        occ, occ + competence_offset,
        NULLIF(r.template->>'supplier', ''), NULLIF(r.template->>'cost_center', '')
      )
      ON CONFLICT (recurring_plan_id, occurrence_date)
      WHERE recurring_plan_id IS NOT NULL AND deleted_at IS NULL
      DO NOTHING;
    ELSE
      INSERT INTO public.cash_flow_entries (
        establishment_id, entry_type, category, description, amount, payment_method,
        status, entry_date, source, notes, recurring_plan_id, occurrence_date
      )
      VALUES (
        r.tenant_id, 'income', COALESCE(r.template->>'category', 'Receita recorrente'),
        r.template->>'description', (r.template->>'amount')::numeric,
        r.template->>'payment_method', 'pending', occ::timestamptz, 'recurrence',
        r.template->>'notes', r.id, occ
      )
      ON CONFLICT (recurring_plan_id, occurrence_date)
      WHERE recurring_plan_id IS NOT NULL AND deleted_at IS NULL
      DO NOTHING;
    END IF;

    generated := generated + 1;
    occ := (r.start_date::timestamp + public.financial_recurrence_step(r.frequency, idx))::date;
  END LOOP;

  UPDATE public.financial_recurrences
  SET last_generated_date = stop_date, updated_at = now()
  WHERE id = r.id;

  RETURN generated;
END;
$function$;

-- Safe backfill: only untouched (unpaid, not cancelled, not deleted) recurring occurrences.
UPDATE public.expenses e
SET due_date = e.occurrence_date,
    competence_date = e.occurrence_date,
    expense_date = e.occurrence_date::timestamptz,
    updated_at = now()
WHERE e.recurring_plan_id IS NOT NULL
  AND e.occurrence_date IS NOT NULL
  AND e.deleted_at IS NULL
  AND COALESCE(e.paid_amount, 0) = 0
  AND e.status NOT IN ('paid', 'confirmed', 'cancelled')
  AND e.due_date IS DISTINCT FROM e.occurrence_date;

NOTIFY pgrst, 'reload schema';