-- Recurring financial entries for payables (expenses) and receivables (cash flow)
CREATE TABLE IF NOT EXISTS public.financial_recurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('payable','receivable')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','biweekly','monthly','bimonthly','quarterly','semiannual','annual')),
  interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  start_date DATE NOT NULL,
  end_date DATE,
  max_occurrences INTEGER CHECK (max_occurrences IS NULL OR max_occurrences > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  last_generated_date DATE,
  template JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

ALTER TABLE public.financial_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments can manage their financial recurrences"
ON public.financial_recurrences
FOR ALL
USING (tenant_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Super admins can view all financial recurrences"
ON public.financial_recurrences
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_financial_recurrences_updated_at
BEFORE UPDATE ON public.financial_recurrences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','pending','paid')),
  ADD COLUMN IF NOT EXISTS recurring_plan_id UUID REFERENCES public.financial_recurrences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS occurrence_date DATE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.cash_flow_entries
  ADD COLUMN IF NOT EXISTS recurring_plan_id UUID REFERENCES public.financial_recurrences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS occurrence_date DATE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.cash_flow_entries DROP CONSTRAINT IF EXISTS cash_flow_entries_source_check;
ALTER TABLE public.cash_flow_entries ADD CONSTRAINT cash_flow_entries_source_check CHECK (source IN ('sale','expense','manual','recurrence'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_recurring_occurrence
  ON public.expenses(recurring_plan_id, occurrence_date) WHERE recurring_plan_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cfe_recurring_occurrence
  ON public.cash_flow_entries(recurring_plan_id, occurrence_date) WHERE recurring_plan_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_financial_recurrences_due
  ON public.financial_recurrences(active, tenant_id, last_generated_date, start_date);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring_filter
  ON public.expenses(establishment_id, recurring_plan_id, expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cfe_recurring_filter
  ON public.cash_flow_entries(establishment_id, recurring_plan_id, entry_date DESC) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.financial_recurrence_step(freq TEXT, mult INTEGER DEFAULT 1)
RETURNS INTERVAL LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE freq
    WHEN 'daily' THEN make_interval(days => 1 * mult)
    WHEN 'weekly' THEN make_interval(days => 7 * mult)
    WHEN 'biweekly' THEN make_interval(days => 14 * mult)
    WHEN 'monthly' THEN make_interval(months => 1 * mult)
    WHEN 'bimonthly' THEN make_interval(months => 2 * mult)
    WHEN 'quarterly' THEN make_interval(months => 3 * mult)
    WHEN 'semiannual' THEN make_interval(months => 6 * mult)
    WHEN 'annual' THEN make_interval(years => 1 * mult)
    ELSE make_interval(months => 1 * mult)
  END;
$$;

CREATE OR REPLACE FUNCTION public.create_financial_recurrence(
  p_tenant_id UUID,
  p_tipo TEXT,
  p_frequency TEXT,
  p_start_date DATE,
  p_end_date DATE DEFAULT NULL,
  p_max_occurrences INTEGER DEFAULT NULL,
  p_template JSONB DEFAULT '{}'::jsonb,
  p_generate_until DATE DEFAULT (CURRENT_DATE + INTERVAL '12 months')::date
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF p_end_date IS NOT NULL AND p_max_occurrences IS NOT NULL THEN
    RAISE EXCEPTION 'Informe data final ou quantidade de ocorrências, não ambos';
  END IF;

  INSERT INTO public.financial_recurrences(tenant_id, tipo, frequency, start_date, end_date, max_occurrences, template)
  VALUES (p_tenant_id, p_tipo, p_frequency, p_start_date, p_end_date, p_max_occurrences, p_template)
  RETURNING id INTO v_id;

  PERFORM public.generate_financial_recurrence(v_id, p_generate_until);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_financial_recurrence(p_recurrence_id UUID, p_until DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.financial_recurrences%ROWTYPE; occ DATE; generated INTEGER := 0; idx INTEGER := 0; stop_date DATE;
BEGIN
  SELECT * INTO r FROM public.financial_recurrences WHERE id = p_recurrence_id AND active = true FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;

  stop_date := LEAST(COALESCE(r.end_date, p_until), p_until);
  occ := r.start_date;
  WHILE occ <= stop_date LOOP
    idx := idx + 1;
    IF r.max_occurrences IS NOT NULL AND idx > r.max_occurrences THEN EXIT; END IF;

    IF r.tipo = 'payable' THEN
      INSERT INTO public.expenses(establishment_id, description, amount, category, expense_date, notes, status, recurring_plan_id, occurrence_date)
      VALUES (r.tenant_id, r.template->>'description', (r.template->>'amount')::numeric, r.template->>'category', occ::timestamptz, r.template->>'notes', 'pending', r.id, occ)
      ON CONFLICT (recurring_plan_id, occurrence_date) WHERE recurring_plan_id IS NOT NULL AND deleted_at IS NULL DO NOTHING;
    ELSE
      INSERT INTO public.cash_flow_entries(establishment_id, entry_type, category, description, amount, payment_method, status, entry_date, source, notes, recurring_plan_id, occurrence_date)
      VALUES (r.tenant_id, 'income', COALESCE(r.template->>'category','Receita recorrente'), r.template->>'description', (r.template->>'amount')::numeric, r.template->>'payment_method', 'pending', occ::timestamptz, 'recurrence', r.template->>'notes', r.id, occ)
      ON CONFLICT (recurring_plan_id, occurrence_date) WHERE recurring_plan_id IS NOT NULL AND deleted_at IS NULL DO NOTHING;
    END IF;
    generated := generated + 1;
    occ := (occ::timestamp + public.financial_recurrence_step(r.frequency, r.interval_count))::date;
  END LOOP;

  UPDATE public.financial_recurrences SET last_generated_date = stop_date, active = CASE WHEN r.end_date IS NOT NULL AND stop_date >= r.end_date THEN false ELSE active END WHERE id = r.id;
  RETURN generated;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_due_financial_recurrences(p_until DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec RECORD; total INTEGER := 0;
BEGIN
  FOR rec IN SELECT id FROM public.financial_recurrences WHERE active = true AND start_date <= p_until LOOP
    total := total + public.generate_financial_recurrence(rec.id, p_until);
  END LOOP;
  RETURN total;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_expense_to_cash_flow()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.cash_flow_entries WHERE source = 'expense' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cash_flow_entries (establishment_id, entry_type, category, description, amount, payment_method, status, entry_date, source, source_id, notes, recurring_plan_id, occurrence_date)
    VALUES (NEW.establishment_id, 'expense', COALESCE(NEW.category, 'Despesa'), NEW.description, NEW.amount,
      CASE WHEN NEW.notes ~* 'pix|dinheiro|cart[ãa]o|d[eé]bito|cr[eé]dito|boleto|transfer' THEN NEW.notes ELSE NULL END,
      CASE WHEN NEW.status = 'pending' THEN 'pending' ELSE 'confirmed' END, NEW.expense_date, 'expense', NEW.id, NEW.notes, NEW.recurring_plan_id, NEW.occurrence_date);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_flow_entries SET establishment_id = NEW.establishment_id, category = COALESCE(NEW.category, 'Despesa'), description = NEW.description,
      amount = NEW.amount, status = CASE WHEN NEW.status = 'pending' THEN 'pending' ELSE 'confirmed' END, entry_date = NEW.expense_date,
      notes = NEW.notes, recurring_plan_id = NEW.recurring_plan_id, occurrence_date = NEW.occurrence_date, updated_at = now()
    WHERE source = 'expense' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

-- Daily automatic generation. If pg_cron is unavailable in an environment,
-- the function above can still be invoked by an external scheduler.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
SELECT cron.schedule(
  'generate-due-financial-recurrences-daily',
  '5 3 * * *',
  $$SELECT public.generate_due_financial_recurrences(CURRENT_DATE);$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'generate-due-financial-recurrences-daily'
);
