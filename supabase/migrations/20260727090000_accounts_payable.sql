-- Complete accounts payable lifecycle. Existing `confirmed` expenses are preserved as paid.
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
UPDATE public.expenses SET status = 'paid' WHERE status = 'confirmed';

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
    paid_amount = CASE WHEN status = 'paid' THEN amount ELSE paid_amount END;
ALTER TABLE public.expenses ALTER COLUMN due_date SET NOT NULL;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_status_check
  CHECK (status IN ('pending','due_today','overdue','partially_paid','paid','cancelled'));
ALTER TABLE public.expenses ADD CONSTRAINT expenses_paid_amount_check
  CHECK (paid_amount >= 0 AND paid_amount <= amount);

CREATE TABLE IF NOT EXISTS public.expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0), interest NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (interest >= 0),
  fine NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (fine >= 0), discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  final_amount NUMERIC(12,2) GENERATED ALWAYS AS (amount + interest + fine - discount) STORED,
  payment_method TEXT NOT NULL, financial_account TEXT NOT NULL, notes TEXT, created_by UUID NOT NULL DEFAULT auth.uid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.expense_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), expense_id UUID, establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(), operation TEXT NOT NULL CHECK (operation IN ('create','update','payment','delete','cancel')),
  old_values JSONB, new_values JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.expense_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, file_name TEXT NOT NULL, storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')), created_by UUID NOT NULL DEFAULT auth.uid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(expense_id, storage_path)
);

ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant reads expense payments" ON public.expense_payments FOR SELECT USING (establishment_id = public.current_establishment_id());
CREATE POLICY "Tenant reads expense audit" ON public.expense_audit_logs FOR SELECT USING (establishment_id = public.current_establishment_id());
CREATE POLICY "Tenant reads expense attachments" ON public.expense_attachments FOR SELECT USING (establishment_id = public.current_establishment_id());
CREATE POLICY "Managers manage expense attachments" ON public.expense_attachments FOR ALL USING (establishment_id = public.current_establishment_id() AND public.current_establishment_role() IN ('owner','admin')) WITH CHECK (establishment_id = public.current_establishment_id() AND public.current_establishment_role() IN ('owner','admin'));

CREATE INDEX IF NOT EXISTS idx_expenses_payable_filters ON public.expenses(establishment_id, due_date, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_supplier ON public.expenses(establishment_id, supplier) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_payments_expense ON public.expense_payments(expense_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_expense_audit_expense ON public.expense_audit_logs(expense_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.payable_status(e public.expenses) RETURNS TEXT LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN e.status = 'cancelled' THEN 'cancelled' WHEN e.paid_amount >= e.amount THEN 'paid'
   WHEN e.paid_amount > 0 THEN 'partially_paid' WHEN e.due_date < CURRENT_DATE THEN 'overdue'
   WHEN e.due_date = CURRENT_DATE THEN 'due_today' ELSE 'pending' END
$$;

CREATE OR REPLACE FUNCTION public.refresh_expense_status() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  NEW.status := CASE WHEN NEW.status = 'cancelled' THEN 'cancelled' WHEN NEW.paid_amount >= NEW.amount THEN 'paid'
    WHEN NEW.paid_amount > 0 THEN 'partially_paid' WHEN NEW.due_date < CURRENT_DATE THEN 'overdue'
    WHEN NEW.due_date = CURRENT_DATE THEN 'due_today' ELSE 'pending' END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS refresh_expense_status_trigger ON public.expenses;
CREATE TRIGGER refresh_expense_status_trigger BEFORE INSERT OR UPDATE OF amount, paid_amount, due_date, status ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.refresh_expense_status();

CREATE OR REPLACE FUNCTION public.assert_payable_manager(p_establishment UUID, p_admin_only BOOLEAN DEFAULT false) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF p_establishment <> public.current_establishment_id() OR public.current_establishment_role() NOT IN ('owner','admin') THEN
   RAISE EXCEPTION 'Sem permissão para alterar contas a pagar';
 END IF;
 IF p_admin_only AND public.current_establishment_role() <> 'owner' THEN RAISE EXCEPTION 'Operação exclusiva do administrador'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_payable(p_id UUID, p_changes JSONB) RETURNS public.expenses
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE old_row expenses%ROWTYPE; new_row expenses%ROWTYPE; BEGIN
 SELECT * INTO old_row FROM expenses WHERE id=p_id AND deleted_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;
 PERFORM assert_payable_manager(old_row.establishment_id, old_row.status='paid');
 UPDATE expenses SET description=COALESCE(p_changes->>'description',description), supplier=COALESCE(p_changes->>'supplier',supplier),
 category=COALESCE(p_changes->>'category',category), cost_center=COALESCE(p_changes->>'cost_center',cost_center), notes=COALESCE(p_changes->>'notes',notes),
 amount=COALESCE((p_changes->>'amount')::numeric,amount), due_date=COALESCE((p_changes->>'due_date')::date,due_date),
 competence_date=COALESCE((p_changes->>'competence_date')::date,competence_date), expense_date=COALESCE((p_changes->>'due_date')::timestamptz,expense_date)
 WHERE id=p_id RETURNING * INTO new_row;
 INSERT INTO expense_audit_logs(expense_id,establishment_id,operation,old_values,new_values) VALUES(p_id,old_row.establishment_id,'update',to_jsonb(old_row),to_jsonb(new_row)); RETURN new_row;
END $$;

CREATE OR REPLACE FUNCTION public.pay_expense(p_id UUID,p_payment_date DATE,p_amount NUMERIC,p_method TEXT,p_account TEXT,p_interest NUMERIC DEFAULT 0,p_fine NUMERIC DEFAULT 0,p_discount NUMERIC DEFAULT 0,p_notes TEXT DEFAULT NULL) RETURNS public.expenses
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE e expenses%ROWTYPE; result expenses%ROWTYPE; pay_id UUID; BEGIN
 SELECT * INTO e FROM expenses WHERE id=p_id AND deleted_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF; PERFORM assert_payable_manager(e.establishment_id);
 IF e.status='cancelled' OR p_amount<=0 OR e.paid_amount+p_amount>e.amount THEN RAISE EXCEPTION 'Pagamento inválido ou superior ao saldo'; END IF;
 INSERT INTO expense_payments(expense_id,establishment_id,payment_date,amount,interest,fine,discount,payment_method,financial_account,notes)
 VALUES(p_id,e.establishment_id,p_payment_date,p_amount,COALESCE(p_interest,0),COALESCE(p_fine,0),COALESCE(p_discount,0),p_method,p_account,p_notes) RETURNING id INTO pay_id;
 UPDATE expenses SET paid_amount=paid_amount+p_amount, paid_at=CASE WHEN paid_amount+p_amount=amount THEN p_payment_date::timestamptz ELSE paid_at END, paid_by=auth.uid() WHERE id=p_id RETURNING * INTO result;
 INSERT INTO cash_flow_entries(establishment_id,entry_type,category,description,amount,payment_method,status,entry_date,source,source_id,notes)
 VALUES(e.establishment_id,'expense',COALESCE(e.category,'Despesa'),e.description,p_amount+COALESCE(p_interest,0)+COALESCE(p_fine,0)-COALESCE(p_discount,0),p_method,'confirmed',p_payment_date::timestamptz,'expense_payment',pay_id,p_notes);
 INSERT INTO expense_audit_logs(expense_id,establishment_id,operation,old_values,new_values) VALUES(p_id,e.establishment_id,'payment',to_jsonb(e),jsonb_build_object('payment_id',pay_id,'expense',to_jsonb(result))); RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.delete_payable(p_id UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE e expenses%ROWTYPE; BEGIN
 SELECT * INTO e FROM expenses WHERE id=p_id AND deleted_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF; PERFORM assert_payable_manager(e.establishment_id,true);
 DELETE FROM cash_flow_entries WHERE (source='expense_payment' AND source_id IN (SELECT id FROM expense_payments WHERE expense_id=p_id)) OR (source='expense' AND source_id=p_id);
 INSERT INTO expense_audit_logs(expense_id,establishment_id,operation,old_values) VALUES(p_id,e.establishment_id,'delete',to_jsonb(e)); UPDATE expenses SET deleted_at=now() WHERE id=p_id;
END $$;

-- The legacy trigger now maintains only the forecast; realized payments are inserted by pay_expense.
CREATE OR REPLACE FUNCTION public.sync_expense_to_cash_flow() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='DELETE' THEN DELETE FROM cash_flow_entries WHERE source='expense' AND source_id=OLD.id; RETURN OLD; END IF;
 IF NEW.deleted_at IS NOT NULL OR NEW.status IN ('paid','cancelled') THEN DELETE FROM cash_flow_entries WHERE source='expense' AND source_id=NEW.id; RETURN NEW; END IF;
 INSERT INTO cash_flow_entries(establishment_id,entry_type,category,description,amount,status,entry_date,source,source_id,notes)
 VALUES(NEW.establishment_id,'expense',COALESCE(NEW.category,'Despesa'),NEW.description,NEW.amount-NEW.paid_amount,'pending',NEW.due_date::timestamptz,'expense',NEW.id,NEW.notes)
 ON CONFLICT DO NOTHING;
 UPDATE cash_flow_entries SET amount=NEW.amount-NEW.paid_amount,entry_date=NEW.due_date::timestamptz,description=NEW.description,category=COALESCE(NEW.category,'Despesa'),notes=NEW.notes WHERE source='expense' AND source_id=NEW.id;
 RETURN NEW; END $$;

ALTER TABLE public.cash_flow_entries DROP CONSTRAINT IF EXISTS cash_flow_entries_source_check;
ALTER TABLE public.cash_flow_entries ADD CONSTRAINT cash_flow_entries_source_check CHECK(source IN ('sale','expense','expense_payment','appointment_deposit','sale_fee','manual','recurrence'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_expense_forecast ON public.cash_flow_entries(source,source_id) WHERE source='expense' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.create_payables(p_establishment UUID,p_data JSONB,p_installments INTEGER DEFAULT 1) RETURNS SETOF public.expenses
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE i INTEGER; gid UUID := CASE WHEN p_installments>1 THEN gen_random_uuid() END; base_amount NUMERIC; parcel NUMERIC; due DATE; row expenses%ROWTYPE; BEGIN
 PERFORM assert_payable_manager(p_establishment); IF p_installments<1 OR p_installments>360 THEN RAISE EXCEPTION 'Quantidade de parcelas inválida'; END IF;
 base_amount := (p_data->>'amount')::numeric; IF base_amount<=0 THEN RAISE EXCEPTION 'Valor inválido'; END IF; parcel := round(base_amount/p_installments,2);
 FOR i IN 1..p_installments LOOP
  due := (p_data->>'due_date')::date + make_interval(months=>i-1);
  INSERT INTO expenses(establishment_id,description,amount,category,supplier,cost_center,notes,due_date,competence_date,expense_date,status,installment_group_id,installment_number,installment_count,created_by)
  VALUES(p_establishment,CASE WHEN p_installments>1 THEN (p_data->>'description')||' ('||i||'/'||p_installments||')' ELSE p_data->>'description' END,
   CASE WHEN i=p_installments THEN base_amount-parcel*(p_installments-1) ELSE parcel END,p_data->>'category',NULLIF(p_data->>'supplier',''),NULLIF(p_data->>'cost_center',''),NULLIF(p_data->>'notes',''),due,COALESCE((p_data->>'competence_date')::date,due),due::timestamptz,'pending',gid,i,p_installments,auth.uid()) RETURNING * INTO row;
  INSERT INTO expense_audit_logs(expense_id,establishment_id,operation,new_values) VALUES(row.id,p_establishment,'create',to_jsonb(row)); RETURN NEXT row;
 END LOOP; RETURN;
END $$;

GRANT EXECUTE ON FUNCTION public.create_payables(UUID,JSONB,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_payable(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_expense(UUID,DATE,NUMERIC,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_payable(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_expense_status() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  NEW.due_date := COALESCE(NEW.due_date, NEW.expense_date::date);
  NEW.competence_date := COALESCE(NEW.competence_date, NEW.expense_date::date);
  NEW.status := CASE WHEN NEW.status = 'cancelled' THEN 'cancelled' WHEN NEW.paid_amount >= NEW.amount THEN 'paid'
    WHEN NEW.paid_amount > 0 THEN 'partially_paid' WHEN NEW.due_date < CURRENT_DATE THEN 'overdue'
    WHEN NEW.due_date = CURRENT_DATE THEN 'due_today' ELSE 'pending' END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_expenses_cash_flow ON public.expenses;
DROP TRIGGER IF EXISTS sync_expense_cash_flow ON public.expenses;
DROP TRIGGER IF EXISTS sync_expense_to_cash_flow_trigger ON public.expenses;
CREATE TRIGGER sync_expense_cash_flow AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.sync_expense_to_cash_flow();

CREATE OR REPLACE FUNCTION public.refresh_due_expense_statuses() RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n INTEGER; BEGIN
 UPDATE expenses SET status=CASE WHEN due_date=CURRENT_DATE THEN 'due_today' ELSE 'overdue' END
 WHERE deleted_at IS NULL AND paid_amount=0 AND status NOT IN ('paid','cancelled') AND due_date<=CURRENT_DATE;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $$;
SELECT cron.schedule('refresh-payables-status-daily','1 0 * * *',$$SELECT public.refresh_due_expense_statuses();$$)
WHERE NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='refresh-payables-status-daily');
NOTIFY pgrst, 'reload schema';
