CREATE OR REPLACE FUNCTION public.sync_ambassador_commissions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ambassador_referrals; p record; v_first date; v_month date; v_rate numeric; v_target numeric; v_existing numeric; v_base numeric;
BEGIN
 SELECT * INTO r FROM public.ambassador_referrals WHERE establishment_id=NEW.establishment_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.ambassadors WHERE id=r.ambassador_id FOR UPDATE;
 SELECT min(date_trunc('month',coalesce(sp.due_date,(sp.payment_date AT TIME ZONE 'America/Sao_Paulo')::date))::date) INTO v_first
 FROM public.subscription_payments sp WHERE sp.establishment_id=r.establishment_id AND sp.created_at>=r.created_at
 AND sp.payment_source='asaas' AND sp.asaas_payment_id IS NOT NULL
 AND (sp.status IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH') OR EXISTS(SELECT 1 FROM public.ambassador_commission_entries e WHERE e.payment_id=sp.id)) AND sp.value>0;
 FOR p IN SELECT sp.* FROM public.subscription_payments sp WHERE sp.establishment_id=r.establishment_id AND sp.created_at>=r.created_at AND ((sp.payment_source='asaas' AND sp.asaas_payment_id IS NOT NULL) OR EXISTS(SELECT 1 FROM public.ambassador_commission_entries e WHERE e.payment_id=sp.id)) ORDER BY sp.due_date,sp.id LOOP
  v_month:=date_trunc('month',coalesce(p.due_date,(p.payment_date AT TIME ZONE 'America/Sao_Paulo')::date))::date;
  v_rate:=public.ambassador_commission_rate(p.ambassador_plan_slug,v_month=v_first);
  SELECT coalesce(sum(amount),0) INTO v_existing FROM public.ambassador_commission_entries WHERE payment_id=p.id;
  v_base:=greatest(coalesce(p.value,0)-CASE WHEN coalesce(p.raw->>'refundedValue','') ~ '^[0-9]+([.][0-9]+)?$' THEN (p.raw->>'refundedValue')::numeric ELSE 0 END,0);
  IF p.payment_source='asaas' AND p.asaas_payment_id IS NOT NULL AND p.status IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH') AND p.payment_date IS NOT NULL AND v_rate IS NOT NULL AND v_month IS NOT NULL THEN v_target:=round(v_base*v_rate/100,2); ELSE v_target:=0; END IF;
  IF v_target<>v_existing THEN
   INSERT INTO public.ambassador_commission_entries(referral_id,ambassador_id,payment_id,amount,base_amount,rate,plan_slug,billing_month,reason)
   VALUES(r.id,r.ambassador_id,p.id,v_target-v_existing,v_base,coalesce(v_rate,0),coalesce(p.ambassador_plan_slug,'unknown'),coalesce(v_month,v_first,current_date),CASE WHEN v_target=0 THEN 'Estorno / pagamento não elegível' WHEN v_existing=0 THEN 'Pagamento confirmado' ELSE 'Ajuste de fatura / ciclo' END);
  END IF;
 END LOOP;
 RETURN NEW;
END; $$;
CREATE FUNCTION public.guard_ambassador_changes() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_error text;
BEGIN
 IF NEW.code<>OLD.code THEN RAISE EXCEPTION 'O código de indicação não pode ser alterado'; END IF;
 v_error:=public.contact_phone_error(NEW.whatsapp,false);
 IF v_error IS NOT NULL THEN RAISE EXCEPTION '%',v_error; END IF;
 NEW.whatsapp:=public.normalize_br_phone(NEW.whatsapp);
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_ambassador_changes BEFORE UPDATE ON public.ambassadors FOR EACH ROW EXECUTE FUNCTION public.guard_ambassador_changes();