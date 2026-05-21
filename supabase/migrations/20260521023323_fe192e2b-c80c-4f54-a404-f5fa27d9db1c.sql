
-- 1. Sales: campos financeiros
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS gross_amount numeric,
  ADD COLUMN IF NOT EXISTS fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric,
  ADD COLUMN IF NOT EXISTS card_machine_id uuid,
  ADD COLUMN IF NOT EXISTS installments integer;

-- 2. Professionals: tipo de comissão
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'per_service',
  ADD COLUMN IF NOT EXISTS custom_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_amount numeric NOT NULL DEFAULT 0;

-- 3. Card machines
CREATE TABLE IF NOT EXISTS public.card_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.card_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments can manage their card machines"
  ON public.card_machines FOR ALL
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can view all card machines"
  ON public.card_machines FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_card_machines_updated_at
  BEFORE UPDATE ON public.card_machines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Card machine fees
CREATE TABLE IF NOT EXISTS public.card_machine_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  card_machine_id uuid NOT NULL REFERENCES public.card_machines(id) ON DELETE CASCADE,
  payment_type text NOT NULL, -- 'debit' | 'credit' | 'credit_installment'
  installments integer, -- NULL for debit/credit_at_sight; 2..12 for installment
  fee_percentage numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_machine_fees_machine ON public.card_machine_fees(card_machine_id);

ALTER TABLE public.card_machine_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments can manage their card machine fees"
  ON public.card_machine_fees FOR ALL
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can view all card machine fees"
  ON public.card_machine_fees FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_card_machine_fees_updated_at
  BEFORE UPDATE ON public.card_machine_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Update trigger: sale -> cash flow with fee handling
CREATE OR REPLACE FUNCTION public.sync_sale_to_cash_flow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  svc_name TEXT;
  v_fee numeric;
  v_net numeric;
  v_gross numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.cash_flow_entries WHERE source = 'sale' AND source_id = OLD.id;
    DELETE FROM public.cash_flow_entries WHERE source = 'sale_fee' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT name INTO svc_name FROM public.services WHERE id = NEW.service_id;

  v_fee := COALESCE(NEW.fee_amount, 0);
  v_gross := COALESCE(NEW.gross_amount, NEW.amount);
  v_net := COALESCE(NEW.net_amount, NEW.amount - v_fee);

  IF TG_OP = 'INSERT' THEN
    -- Income (gross or net depending on fee setup; we lançar bruto e despesa de taxa)
    INSERT INTO public.cash_flow_entries (
      establishment_id, entry_type, category, description, amount,
      payment_method, status, entry_date, source, source_id, notes
    ) VALUES (
      NEW.establishment_id, 'income', 'Serviço',
      COALESCE(svc_name, 'Venda'), v_gross,
      NEW.payment_method, 'confirmed', NEW.sale_date,
      'sale', NEW.id, NEW.notes
    );

    IF v_fee > 0 THEN
      INSERT INTO public.cash_flow_entries (
        establishment_id, entry_type, category, description, amount,
        payment_method, status, entry_date, source, source_id, notes
      ) VALUES (
        NEW.establishment_id, 'expense', 'Taxa de cartão',
        'Taxa ' || COALESCE(NEW.payment_method, 'cartão') ||
          CASE WHEN NEW.installments IS NOT NULL AND NEW.installments > 1
               THEN ' ' || NEW.installments || 'x' ELSE '' END,
        v_fee, NEW.payment_method, 'confirmed', NEW.sale_date,
        'sale_fee', NEW.id, 'Taxa automática da venda'
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_flow_entries SET
      establishment_id = NEW.establishment_id,
      description = COALESCE(svc_name, 'Venda'),
      amount = v_gross,
      payment_method = NEW.payment_method,
      entry_date = NEW.sale_date,
      notes = NEW.notes,
      updated_at = now()
    WHERE source = 'sale' AND source_id = NEW.id;

    DELETE FROM public.cash_flow_entries WHERE source = 'sale_fee' AND source_id = NEW.id;
    IF v_fee > 0 THEN
      INSERT INTO public.cash_flow_entries (
        establishment_id, entry_type, category, description, amount,
        payment_method, status, entry_date, source, source_id, notes
      ) VALUES (
        NEW.establishment_id, 'expense', 'Taxa de cartão',
        'Taxa ' || COALESCE(NEW.payment_method, 'cartão') ||
          CASE WHEN NEW.installments IS NOT NULL AND NEW.installments > 1
               THEN ' ' || NEW.installments || 'x' ELSE '' END,
        v_fee, NEW.payment_method, 'confirmed', NEW.sale_date,
        'sale_fee', NEW.id, 'Taxa automática da venda'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
