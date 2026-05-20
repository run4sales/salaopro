
-- Cash flow ledger table
CREATE TABLE public.cash_flow_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income','expense')),
  category TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','pending')),
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('sale','expense','manual')),
  source_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_cfe_estab_date ON public.cash_flow_entries(establishment_id, entry_date DESC);
CREATE INDEX idx_cfe_source ON public.cash_flow_entries(source, source_id);

ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments can manage their cash flow"
ON public.cash_flow_entries
FOR ALL
USING (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Super admins can view all cash flow"
ON public.cash_flow_entries
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_cash_flow_entries_updated_at
BEFORE UPDATE ON public.cash_flow_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync function: sales -> cash_flow
CREATE OR REPLACE FUNCTION public.sync_sale_to_cash_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE svc_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.cash_flow_entries WHERE source = 'sale' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT name INTO svc_name FROM public.services WHERE id = NEW.service_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cash_flow_entries (
      establishment_id, entry_type, category, description, amount,
      payment_method, status, entry_date, source, source_id, notes
    ) VALUES (
      NEW.establishment_id, 'income', 'Serviço',
      COALESCE(svc_name, 'Venda'), NEW.amount,
      NEW.payment_method, 'confirmed', NEW.sale_date,
      'sale', NEW.id, NEW.notes
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_flow_entries SET
      establishment_id = NEW.establishment_id,
      description = COALESCE(svc_name, 'Venda'),
      amount = NEW.amount,
      payment_method = NEW.payment_method,
      entry_date = NEW.sale_date,
      notes = NEW.notes,
      updated_at = now()
    WHERE source = 'sale' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sales_cash_flow
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_to_cash_flow();

-- Sync function: expenses -> cash_flow
CREATE OR REPLACE FUNCTION public.sync_expense_to_cash_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      NEW.description, NEW.amount,
      CASE WHEN NEW.notes ~* 'pix|dinheiro|cart[ãa]o|d[eé]bito|cr[eé]dito|boleto|transfer' THEN NEW.notes ELSE NULL END,
      'confirmed', NEW.expense_date, 'expense', NEW.id, NEW.notes
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_flow_entries SET
      establishment_id = NEW.establishment_id,
      category = COALESCE(NEW.category, 'Despesa'),
      description = NEW.description,
      amount = NEW.amount,
      entry_date = NEW.expense_date,
      notes = NEW.notes,
      updated_at = now()
    WHERE source = 'expense' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_expenses_cash_flow
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.sync_expense_to_cash_flow();

-- Backfill existing data
INSERT INTO public.cash_flow_entries (establishment_id, entry_type, category, description, amount, payment_method, status, entry_date, source, source_id, notes)
SELECT s.establishment_id, 'income', 'Serviço', COALESCE(sv.name, 'Venda'), s.amount, s.payment_method, 'confirmed', s.sale_date, 'sale', s.id, s.notes
FROM public.sales s LEFT JOIN public.services sv ON sv.id = s.service_id
WHERE NOT EXISTS (SELECT 1 FROM public.cash_flow_entries c WHERE c.source = 'sale' AND c.source_id = s.id);

INSERT INTO public.cash_flow_entries (establishment_id, entry_type, category, description, amount, payment_method, status, entry_date, source, source_id, notes)
SELECT e.establishment_id, 'expense', COALESCE(e.category, 'Despesa'), e.description, e.amount,
  CASE WHEN e.notes ~* 'pix|dinheiro|cart[ãa]o|d[eé]bito|cr[eé]dito|boleto|transfer' THEN e.notes ELSE NULL END,
  'confirmed', e.expense_date, 'expense', e.id, e.notes
FROM public.expenses e
WHERE NOT EXISTS (SELECT 1 FROM public.cash_flow_entries c WHERE c.source = 'expense' AND c.source_id = e.id);
