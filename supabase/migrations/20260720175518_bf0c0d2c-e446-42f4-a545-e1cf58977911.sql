
-- =========================================================
-- 1) Soft delete columns
-- =========================================================
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_reason text,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sales_not_deleted
  ON public.sales (establishment_id, sale_date)
  WHERE deleted_at IS NULL;

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS trg_sales_updated_at ON public.sales;
CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2) Helper: is caller admin/owner of the establishment?
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_establishment_admin(_establishment_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _establishment_id AND p.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.establishment_users eu
    WHERE eu.establishment_id = _establishment_id
      AND eu.user_id = _user_id
      AND eu.active = true
      AND eu.role IN ('admin','owner')
  );
$$;

-- =========================================================
-- 3) Cash-flow trigger: skip deleted rows and clean up on soft delete
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_sale_to_cash_flow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  svc_name TEXT;
  v_fee numeric;
  v_net numeric;
  v_gross numeric;
  v_credit numeric;
  v_cash_income numeric;
  soft_deleted boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.cash_flow_entries WHERE source = 'sale' AND source_id = OLD.id;
    DELETE FROM public.cash_flow_entries WHERE source = 'sale_fee' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Detect transition to soft-deleted
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.cash_flow_entries WHERE source = 'sale' AND source_id = NEW.id;
    DELETE FROM public.cash_flow_entries WHERE source = 'sale_fee' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Skip anything if the row is (still) soft-deleted
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
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

-- =========================================================
-- 4) Handle side effects when a sale is soft-deleted
--    - Restore product stock (if applicable)
--    - Refund customer credit used
--    - Remove commission split (sale_professionals)
--    - Rollback client aggregate stats
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_sale_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.deleted_at IS NULL OR OLD.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  -- Restore stock for products
  SELECT kind INTO v_kind FROM public.services WHERE id = NEW.service_id;
  IF v_kind = 'product' THEN
    UPDATE public.services
       SET stock_quantity = COALESCE(stock_quantity,0) + 1,
           updated_at = now()
     WHERE id = NEW.service_id;
  END IF;

  -- Refund customer credit used by this sale (creates matching credit txn + updates balance)
  PERFORM public.refund_client_credit('sale', NEW.id);

  -- Remove commission split so it stops counting in reports
  DELETE FROM public.sale_professionals WHERE sale_id = NEW.id;

  -- Rollback client aggregate stats
  UPDATE public.clients
     SET total_spent = GREATEST(COALESCE(total_spent,0) - COALESCE(OLD.amount,0), 0),
         visit_count = GREATEST(COALESCE(visit_count,0) - 1, 0),
         updated_at = now()
   WHERE id = NEW.client_id;

  -- Rollback goals
  UPDATE public.goals
     SET current_amount = GREATEST(COALESCE(current_amount,0) - COALESCE(OLD.amount,0), 0),
         updated_at = now()
   WHERE establishment_id = NEW.establishment_id
     AND month = EXTRACT(MONTH FROM OLD.sale_date)
     AND year  = EXTRACT(YEAR  FROM OLD.sale_date);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_soft_delete ON public.sales;
CREATE TRIGGER trg_sale_soft_delete
AFTER UPDATE ON public.sales
FOR EACH ROW
WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
EXECUTE FUNCTION public.handle_sale_soft_delete();

-- =========================================================
-- 5) Restrict UPDATE/DELETE on sales & sale_professionals to admin/owner
--    Existing "manage" policy only covers the owner via profiles.
--    We add a policy allowing admin members too, and keep owner via existing.
-- =========================================================
DROP POLICY IF EXISTS "Admins can update sales" ON public.sales;
CREATE POLICY "Admins can update sales"
  ON public.sales
  FOR UPDATE
  TO authenticated
  USING (public.is_establishment_admin(establishment_id, auth.uid()))
  WITH CHECK (public.is_establishment_admin(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can delete sales" ON public.sales;
CREATE POLICY "Admins can delete sales"
  ON public.sales
  FOR DELETE
  TO authenticated
  USING (public.is_establishment_admin(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can manage sale_professionals" ON public.sale_professionals;
CREATE POLICY "Admins can manage sale_professionals"
  ON public.sale_professionals
  FOR ALL
  TO authenticated
  USING (public.is_establishment_admin(establishment_id, auth.uid()))
  WITH CHECK (public.is_establishment_admin(establishment_id, auth.uid()));

-- =========================================================
-- 6) RPC: admin soft-deletes a sale (with audit log)
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_soft_delete_sale(_sale_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO s FROM public.sales WHERE id = _sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  IF s.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Venda já excluída'; END IF;

  IF NOT public.is_establishment_admin(s.establishment_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para excluir vendas';
  END IF;

  UPDATE public.sales
     SET deleted_at = now(),
         deleted_by = auth.uid(),
         deleted_reason = _reason,
         updated_by = auth.uid()
   WHERE id = _sale_id;

  INSERT INTO public.admin_actions_log (admin_user_id, action, target_establishment_id, details)
  VALUES (
    auth.uid(),
    'sale.soft_delete',
    s.establishment_id,
    jsonb_build_object(
      'sale_id', s.id,
      'reason', _reason,
      'before', to_jsonb(s)
    )
  );
END;
$$;

-- =========================================================
-- 7) RPC: admin updates editable fields of a sale
--    Accepts a JSONB patch. Recognized keys:
--      client_id, service_id, professional_id, amount, gross_amount,
--      fee_amount, net_amount, credit_used, paid_now, payment_method,
--      installments, card_machine_id, notes, sale_date
--    Recalculates cash flow via existing trigger; commission split
--    (sale_professionals) must be re-synced by the frontend after.
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_update_sale(_sale_id uuid, _patch jsonb)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_before public.sales;
  s_after public.sales;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _patch IS NULL THEN RAISE EXCEPTION 'Patch vazio'; END IF;

  SELECT * INTO s_before FROM public.sales WHERE id = _sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  IF s_before.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Não é possível editar uma venda excluída'; END IF;

  IF NOT public.is_establishment_admin(s_before.establishment_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para editar vendas';
  END IF;

  UPDATE public.sales SET
    client_id        = COALESCE( (_patch->>'client_id')::uuid,        client_id ),
    service_id       = COALESCE( (_patch->>'service_id')::uuid,       service_id ),
    professional_id  = CASE WHEN _patch ? 'professional_id' THEN NULLIF(_patch->>'professional_id','')::uuid ELSE professional_id END,
    amount           = COALESCE( (_patch->>'amount')::numeric,        amount ),
    gross_amount     = CASE WHEN _patch ? 'gross_amount' THEN NULLIF(_patch->>'gross_amount','')::numeric ELSE gross_amount END,
    fee_amount       = COALESCE( (_patch->>'fee_amount')::numeric,    fee_amount ),
    net_amount       = CASE WHEN _patch ? 'net_amount' THEN NULLIF(_patch->>'net_amount','')::numeric ELSE net_amount END,
    credit_used      = COALESCE( (_patch->>'credit_used')::numeric,   credit_used ),
    paid_now         = CASE WHEN _patch ? 'paid_now' THEN NULLIF(_patch->>'paid_now','')::numeric ELSE paid_now END,
    payment_method   = CASE WHEN _patch ? 'payment_method' THEN NULLIF(_patch->>'payment_method','') ELSE payment_method END,
    installments     = CASE WHEN _patch ? 'installments' THEN NULLIF(_patch->>'installments','')::int ELSE installments END,
    card_machine_id  = CASE WHEN _patch ? 'card_machine_id' THEN NULLIF(_patch->>'card_machine_id','')::uuid ELSE card_machine_id END,
    notes            = CASE WHEN _patch ? 'notes' THEN _patch->>'notes' ELSE notes END,
    sale_date        = COALESCE( (_patch->>'sale_date')::timestamptz, sale_date ),
    updated_by       = auth.uid(),
    updated_at       = now()
  WHERE id = _sale_id
  RETURNING * INTO s_after;

  INSERT INTO public.admin_actions_log (admin_user_id, action, target_establishment_id, details)
  VALUES (
    auth.uid(),
    'sale.update',
    s_before.establishment_id,
    jsonb_build_object(
      'sale_id', _sale_id,
      'patch', _patch,
      'before', to_jsonb(s_before),
      'after',  to_jsonb(s_after)
    )
  );

  RETURN s_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_soft_delete_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_sale(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_establishment_admin(uuid, uuid) TO authenticated;
