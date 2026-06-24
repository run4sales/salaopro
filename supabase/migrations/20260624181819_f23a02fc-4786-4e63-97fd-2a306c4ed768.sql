
-- Carteira/Crédito do Cliente

-- 1) Saldo de crédito no cliente
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS credit_balance numeric NOT NULL DEFAULT 0;

-- 2) Sinal/adiantamento no agendamento (apenas registro do valor pago como sinal)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_payment_method text;

-- 3) Crédito usado/forma alternativa na venda
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS credit_used numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_now numeric;

-- 4) Tabela de movimentações da carteira
CREATE TABLE IF NOT EXISTS public.client_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit','debit')),
  amount numeric NOT NULL CHECK (amount > 0),
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','appointment_deposit','sale_usage','sale_refund','deposit_refund','adjustment','other')),
  payment_method text,
  description text,
  source text,
  source_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_credit_transactions TO authenticated;
GRANT ALL ON public.client_credit_transactions TO service_role;

ALTER TABLE public.client_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access to credit txns"
ON public.client_credit_transactions FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = establishment_id AND p.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = establishment_id AND p.user_id = auth.uid())
);

CREATE POLICY "Staff read credit txns"
ON public.client_credit_transactions FOR SELECT TO authenticated
USING (public.is_establishment_member(establishment_id, auth.uid()));

CREATE POLICY "Staff insert credit txns"
ON public.client_credit_transactions FOR INSERT TO authenticated
WITH CHECK (public.is_establishment_member(establishment_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_client_credit_txns_client ON public.client_credit_transactions (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_credit_txns_est ON public.client_credit_transactions (establishment_id, created_at DESC);

-- 5) Função para adicionar crédito (manual ou origem)
CREATE OR REPLACE FUNCTION public.add_client_credit(
  _client_id uuid,
  _amount numeric,
  _origin text DEFAULT 'manual',
  _payment_method text DEFAULT NULL,
  _description text DEFAULT NULL,
  _source text DEFAULT NULL,
  _source_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  est_id uuid;
  txn_id uuid;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  SELECT establishment_id INTO est_id FROM public.clients WHERE id = _client_id;
  IF est_id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = est_id AND p.user_id = auth.uid())
    OR public.is_establishment_member(est_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.client_credit_transactions
    (establishment_id, client_id, type, amount, origin, payment_method, description, source, source_id, created_by)
  VALUES
    (est_id, _client_id, 'credit', _amount, COALESCE(_origin,'manual'), _payment_method, _description, _source, _source_id, auth.uid())
  RETURNING id INTO txn_id;

  UPDATE public.clients
     SET credit_balance = COALESCE(credit_balance,0) + _amount,
         updated_at = now()
   WHERE id = _client_id;

  RETURN txn_id;
END; $$;

-- 6) Função para usar crédito (debit)
CREATE OR REPLACE FUNCTION public.use_client_credit(
  _client_id uuid,
  _amount numeric,
  _origin text DEFAULT 'sale_usage',
  _description text DEFAULT NULL,
  _source text DEFAULT NULL,
  _source_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  est_id uuid;
  current_balance numeric;
  txn_id uuid;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  SELECT establishment_id, COALESCE(credit_balance,0)
    INTO est_id, current_balance
  FROM public.clients WHERE id = _client_id FOR UPDATE;

  IF est_id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = est_id AND p.user_id = auth.uid())
    OR public.is_establishment_member(est_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF _amount > current_balance THEN
    RAISE EXCEPTION 'Saldo insuficiente (disponível: %, solicitado: %)', current_balance, _amount;
  END IF;

  INSERT INTO public.client_credit_transactions
    (establishment_id, client_id, type, amount, origin, description, source, source_id, created_by)
  VALUES
    (est_id, _client_id, 'debit', _amount, COALESCE(_origin,'sale_usage'), _description, _source, _source_id, auth.uid())
  RETURNING id INTO txn_id;

  UPDATE public.clients
     SET credit_balance = COALESCE(credit_balance,0) - _amount,
         updated_at = now()
   WHERE id = _client_id;

  RETURN txn_id;
END; $$;

-- 7) Estorno (devolve crédito ao cliente quando venda cancelada)
CREATE OR REPLACE FUNCTION public.refund_client_credit(
  _source text,
  _source_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM public.client_credit_transactions
    WHERE source = _source AND source_id = _source_id AND type = 'debit'
  LOOP
    INSERT INTO public.client_credit_transactions
      (establishment_id, client_id, type, amount, origin, description, source, source_id, created_by)
    VALUES
      (r.establishment_id, r.client_id, 'credit', r.amount, 'sale_refund',
       'Estorno de crédito utilizado', _source, _source_id, auth.uid());

    UPDATE public.clients
       SET credit_balance = COALESCE(credit_balance,0) + r.amount,
           updated_at = now()
     WHERE id = r.client_id;
  END LOOP;
END; $$;

-- 8) Trigger: ao deletar/cancelar uma venda que usou crédito, devolver o crédito
CREATE OR REPLACE FUNCTION public.refund_credit_on_sale_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.refund_client_credit('sale', OLD.id);
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_refund_credit_on_sale_delete ON public.sales;
CREATE TRIGGER trg_refund_credit_on_sale_delete
BEFORE DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.refund_credit_on_sale_delete();

-- 9) Trigger: ao deletar agendamento, estornar sinal (remove crédito se ainda houver saldo, e remove receita)
CREATE OR REPLACE FUNCTION public.refund_deposit_on_appointment_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  bal numeric;
BEGIN
  FOR r IN
    SELECT * FROM public.client_credit_transactions
    WHERE source = 'appointment_deposit' AND source_id = OLD.id AND type = 'credit'
  LOOP
    SELECT COALESCE(credit_balance,0) INTO bal FROM public.clients WHERE id = r.client_id FOR UPDATE;
    IF bal >= r.amount THEN
      INSERT INTO public.client_credit_transactions
        (establishment_id, client_id, type, amount, origin, description, source, source_id, created_by)
      VALUES (r.establishment_id, r.client_id, 'debit', r.amount, 'deposit_refund',
              'Estorno do sinal por cancelamento do agendamento', 'appointment_deposit', OLD.id, auth.uid());
      UPDATE public.clients SET credit_balance = COALESCE(credit_balance,0) - r.amount, updated_at = now() WHERE id = r.client_id;
    END IF;
  END LOOP;

  -- Remove receita gerada do fluxo de caixa
  DELETE FROM public.cash_flow_entries WHERE source = 'appointment_deposit' AND source_id = OLD.id;

  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_refund_deposit_on_appt_delete ON public.appointments;
CREATE TRIGGER trg_refund_deposit_on_appt_delete
BEFORE DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.refund_deposit_on_appointment_delete();

-- 10) Ajustar sync_sale_to_cash_flow para registrar apenas o valor pago em dinheiro (gross - credit_used)
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
  v_credit numeric;
  v_cash_income numeric;
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
  v_credit := COALESCE(NEW.credit_used, 0);
  v_cash_income := GREATEST(v_gross - v_credit, 0);

  IF TG_OP = 'INSERT' THEN
    IF v_cash_income > 0 THEN
      INSERT INTO public.cash_flow_entries (
        establishment_id, entry_type, category, description, amount,
        payment_method, status, entry_date, source, source_id, notes
      ) VALUES (
        NEW.establishment_id, 'income', 'Serviço',
        COALESCE(svc_name, 'Venda') || CASE WHEN v_credit > 0 THEN ' (parcial - crédito aplicado)' ELSE '' END,
        v_cash_income,
        NEW.payment_method, 'confirmed', NEW.sale_date,
        'sale', NEW.id, NEW.notes
      );
    END IF;

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
    DELETE FROM public.cash_flow_entries WHERE source = 'sale' AND source_id = NEW.id;
    IF v_cash_income > 0 THEN
      INSERT INTO public.cash_flow_entries (
        establishment_id, entry_type, category, description, amount,
        payment_method, status, entry_date, source, source_id, notes
      ) VALUES (
        NEW.establishment_id, 'income', 'Serviço',
        COALESCE(svc_name, 'Venda') || CASE WHEN v_credit > 0 THEN ' (parcial - crédito aplicado)' ELSE '' END,
        v_cash_income, NEW.payment_method, 'confirmed', NEW.sale_date,
        'sale', NEW.id, NEW.notes
      );
    END IF;

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

-- 11) Função para registrar sinal de agendamento: cria crédito + receita no caixa
CREATE OR REPLACE FUNCTION public.register_appointment_deposit(
  _appointment_id uuid,
  _amount numeric,
  _payment_method text DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a RECORD;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Valor do sinal inválido';
  END IF;

  SELECT * INTO a FROM public.appointments WHERE id = _appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.establishment_id AND p.user_id = auth.uid())
    OR public.is_establishment_member(a.establishment_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF a.client_id IS NULL THEN RAISE EXCEPTION 'Agendamento sem cliente'; END IF;

  -- Adiciona crédito ao cliente
  PERFORM public.add_client_credit(
    a.client_id, _amount, 'appointment_deposit', _payment_method,
    COALESCE(_note, 'Sinal de agendamento'),
    'appointment_deposit', _appointment_id
  );

  -- Registra receita no fluxo de caixa
  INSERT INTO public.cash_flow_entries (
    establishment_id, entry_type, category, description, amount,
    payment_method, status, entry_date, source, source_id, notes
  ) VALUES (
    a.establishment_id, 'income', 'Sinal/Adiantamento',
    'Sinal de agendamento', _amount, _payment_method, 'confirmed',
    a.appointment_date, 'appointment_deposit', _appointment_id, _note
  );

  -- Atualiza agendamento com o valor do sinal
  UPDATE public.appointments
     SET deposit_amount = COALESCE(deposit_amount,0) + _amount,
         deposit_payment_method = COALESCE(_payment_method, deposit_payment_method),
         updated_at = now()
   WHERE id = _appointment_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.add_client_credit(uuid, numeric, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_client_credit(uuid, numeric, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_appointment_deposit(uuid, numeric, text, text) TO authenticated;
