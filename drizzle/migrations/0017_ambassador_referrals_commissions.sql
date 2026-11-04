CREATE TABLE public.ambassadors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL UNIQUE,
 whatsapp text, pix_key text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ambassador_name_valid CHECK(length(trim(name)) BETWEEN 2 AND 120),
 CONSTRAINT ambassador_code_valid CHECK(code ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
 CONSTRAINT ambassador_pix_valid CHECK(pix_key IS NULL OR length(pix_key) <= 255)
);
GRANT SELECT,INSERT,UPDATE ON public.ambassadors TO authenticated;
GRANT ALL ON public.ambassadors TO service_role;
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
CREATE POLICY ambassador_admin_read ON public.ambassadors FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'super_admin'));
CREATE POLICY ambassador_admin_insert ON public.ambassadors FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'super_admin'));
CREATE POLICY ambassador_admin_update ON public.ambassadors FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'super_admin')) WITH CHECK(public.has_role(auth.uid(),'super_admin'));
CREATE TABLE public.ambassador_referrals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id),
 establishment_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id), code text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ambassador_referrals TO authenticated;
GRANT ALL ON public.ambassador_referrals TO service_role;
ALTER TABLE public.ambassador_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_admin_read ON public.ambassador_referrals FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'super_admin'));
CREATE TABLE public.ambassador_commission_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), referral_id uuid NOT NULL REFERENCES public.ambassador_referrals(id),
 ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id), payment_id uuid NOT NULL REFERENCES public.subscription_payments(id),
 amount numeric(14,2) NOT NULL, base_amount numeric(14,2) NOT NULL, rate numeric(5,2) NOT NULL,
 plan_slug text NOT NULL, billing_month date NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ambassador_commission_entries TO authenticated;
GRANT ALL ON public.ambassador_commission_entries TO service_role;
ALTER TABLE public.ambassador_commission_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY commission_admin_read ON public.ambassador_commission_entries FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'super_admin'));
CREATE INDEX ambassador_commission_payment_idx ON public.ambassador_commission_entries(payment_id);
CREATE INDEX ambassador_commission_ambassador_idx ON public.ambassador_commission_entries(ambassador_id);
CREATE TABLE public.ambassador_payouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id),
 amount numeric(14,2) NOT NULL CHECK(amount > 0), paid_on date NOT NULL, receipt_reference text NOT NULL,
 notes text, request_id uuid NOT NULL UNIQUE, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ambassador_receipt_valid CHECK(length(trim(receipt_reference)) BETWEEN 3 AND 500)
);
GRANT SELECT ON public.ambassador_payouts TO authenticated;
GRANT ALL ON public.ambassador_payouts TO service_role;
ALTER TABLE public.ambassador_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY payout_admin_read ON public.ambassador_payouts FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'super_admin'));
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS ambassador_plan_slug text;
COMMENT ON COLUMN public.subscription_payments.ambassador_plan_slug IS 'Plan snapshot for ambassador commissions, only captured for attributed invoices; never infer historical plan from current catalog price.';
CREATE FUNCTION public.ambassador_commission_rate(p_plan text,p_first_month boolean) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_plan NOT IN ('individual','profissional','empresa') OR p_plan IS NULL THEN NULL
 WHEN p_first_month THEN 50 WHEN p_plan='individual' THEN 15 ELSE 20 END::numeric;
$$;
REVOKE ALL ON FUNCTION public.ambassador_commission_rate(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ambassador_commission_rate(text,boolean) TO service_role;
CREATE FUNCTION public.capture_ambassador_referral() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_code text;
BEGIN
 SELECT lower(trim(raw_user_meta_data->>'ambassador_ref')) INTO v_code FROM auth.users WHERE id=NEW.user_id;
 IF v_code ~ '^[a-z0-9][a-z0-9-]{2,39}$' THEN
  INSERT INTO public.ambassador_referrals(ambassador_id,establishment_id,code)
  SELECT id,NEW.id,code FROM public.ambassadors WHERE code=v_code AND active ON CONFLICT(establishment_id) DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.capture_ambassador_referral() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_ambassador_referral AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.capture_ambassador_referral();
CREATE FUNCTION public.snapshot_ambassador_payment_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.ambassador_plan_slug IS NOT NULL THEN
  NEW.ambassador_plan_slug := OLD.ambassador_plan_slug;
 ELSIF EXISTS(SELECT 1 FROM public.ambassador_referrals WHERE establishment_id=NEW.establishment_id AND NEW.created_at>=created_at) THEN
  SELECT p.slug INTO NEW.ambassador_plan_slug FROM public.subscriptions s JOIN public.subscription_plans p ON p.id=s.plan_id WHERE s.id=NEW.subscription_id;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.snapshot_ambassador_payment_plan() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER snapshot_ambassador_payment_plan BEFORE INSERT OR UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.snapshot_ambassador_payment_plan();
CREATE FUNCTION public.sync_ambassador_commissions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ambassador_referrals; p record; v_first date; v_month date; v_rate numeric; v_target numeric; v_existing numeric; v_base numeric;
BEGIN
 SELECT * INTO r FROM public.ambassador_referrals WHERE establishment_id=NEW.establishment_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.ambassadors WHERE id=r.ambassador_id FOR UPDATE;
 SELECT min(date_trunc('month',coalesce(sp.due_date,(sp.payment_date AT TIME ZONE 'America/Sao_Paulo')::date))::date) INTO v_first
 FROM public.subscription_payments sp WHERE sp.establishment_id=r.establishment_id AND sp.created_at>=r.created_at
 AND sp.payment_source='asaas' AND sp.asaas_payment_id IS NOT NULL
 AND (sp.status IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH') OR EXISTS(SELECT 1 FROM public.ambassador_commission_entries e WHERE e.payment_id=sp.id))
 AND sp.value>0;
 FOR p IN SELECT * FROM public.subscription_payments WHERE establishment_id=r.establishment_id AND created_at>=r.created_at AND payment_source='asaas' AND asaas_payment_id IS NOT NULL ORDER BY due_date,id LOOP
  v_month:=date_trunc('month',coalesce(p.due_date,(p.payment_date AT TIME ZONE 'America/Sao_Paulo')::date))::date;
  v_rate:=public.ambassador_commission_rate(p.ambassador_plan_slug,v_month=v_first);
  SELECT coalesce(sum(amount),0) INTO v_existing FROM public.ambassador_commission_entries WHERE payment_id=p.id;
  v_base:=greatest(coalesce(p.value,0)-coalesce(nullif(p.raw->>'refundedValue','')::numeric,0),0);
  IF p.status IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH') AND p.payment_date IS NOT NULL AND v_rate IS NOT NULL AND v_month IS NOT NULL THEN
   v_target:=round(v_base*v_rate/100,2);
  ELSE v_target:=0; END IF;
  IF v_target<>v_existing THEN
   INSERT INTO public.ambassador_commission_entries(referral_id,ambassador_id,payment_id,amount,base_amount,rate,plan_slug,billing_month,reason)
   VALUES(r.id,r.ambassador_id,p.id,v_target-v_existing,v_base,coalesce(v_rate,0),coalesce(p.ambassador_plan_slug,'unknown'),coalesce(v_month,v_first,current_date),
    CASE WHEN v_target=0 THEN 'Estorno / pagamento não elegível' WHEN v_existing=0 THEN 'Pagamento confirmado' ELSE 'Ajuste de fatura / ciclo' END);
  END IF;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sync_ambassador_commissions() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_ambassador_commissions AFTER INSERT OR UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.sync_ambassador_commissions();
CREATE FUNCTION public.register_ambassador_payout(p_ambassador uuid,p_amount numeric,p_paid_on date,p_receipt text,p_notes text,p_request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_balance numeric; v_previous public.ambassador_payouts;
BEGIN
 IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_paid_on IS NULL OR p_paid_on>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR length(trim(coalesce(p_receipt,''))) NOT BETWEEN 3 AND 500 OR length(coalesce(p_notes,''))>2000 THEN RAISE EXCEPTION 'Informe valor, data válida e comprovante do repasse'; END IF;
 PERFORM 1 FROM public.ambassadors WHERE id=p_ambassador FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Embaixador não encontrado'; END IF;
 SELECT * INTO v_previous FROM public.ambassador_payouts WHERE request_id=p_request;
 IF FOUND THEN
  IF v_previous.ambassador_id<>p_ambassador OR v_previous.amount<>p_amount OR v_previous.paid_on<>p_paid_on OR v_previous.receipt_reference<>trim(p_receipt) THEN RAISE EXCEPTION 'Solicitação já utilizada com outros dados'; END IF;
  RETURN v_previous.id;
 END IF;
 SELECT coalesce((SELECT sum(amount) FROM public.ambassador_commission_entries WHERE ambassador_id=p_ambassador),0)-coalesce((SELECT sum(amount) FROM public.ambassador_payouts WHERE ambassador_id=p_ambassador),0) INTO v_balance;
 IF p_amount>v_balance THEN RAISE EXCEPTION 'Valor maior que o saldo disponível'; END IF;
 INSERT INTO public.ambassador_payouts(ambassador_id,amount,paid_on,receipt_reference,notes,request_id,created_by)
 VALUES(p_ambassador,p_amount,p_paid_on,trim(p_receipt),p_notes,p_request,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.register_ambassador_payout(uuid,numeric,date,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_ambassador_payout(uuid,numeric,date,text,text,uuid) TO authenticated;
CREATE FUNCTION public.admin_ambassador_report() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
 'ambassadors',coalesce((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object(
 'referrals',(SELECT count(*) FROM public.ambassador_referrals r WHERE r.ambassador_id=a.id),
 'converted',(SELECT count(*) FROM public.ambassador_referrals r WHERE r.ambassador_id=a.id AND EXISTS(SELECT 1 FROM public.subscription_payments p WHERE p.establishment_id=r.establishment_id AND p.created_at>=r.created_at AND p.payment_source='asaas' AND p.asaas_payment_id IS NOT NULL AND p.status IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH') AND p.payment_date IS NOT NULL AND p.value>0)),
 'earned',coalesce((SELECT sum(amount) FROM public.ambassador_commission_entries WHERE ambassador_id=a.id),0),
 'paid',coalesce((SELECT sum(amount) FROM public.ambassador_payouts WHERE ambassador_id=a.id),0))) FROM public.ambassadors a),'[]'::jsonb),
 'referrals',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('business_name',p.business_name,'plan',sp.name,
 'converted',EXISTS(SELECT 1 FROM public.subscription_payments b WHERE b.establishment_id=r.establishment_id AND b.created_at>=r.created_at AND b.payment_source='asaas' AND b.asaas_payment_id IS NOT NULL AND b.status IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH') AND b.payment_date IS NOT NULL AND b.value>0))) FROM public.ambassador_referrals r JOIN public.profiles p ON p.id=r.establishment_id LEFT JOIN public.subscriptions s ON s.establishment_id=p.id LEFT JOIN public.subscription_plans sp ON sp.id=s.plan_id),'[]'::jsonb),
 'commissions',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('business_name',p.business_name,'invoice_date',b.due_date,'payment_status',b.status)) FROM public.ambassador_commission_entries e JOIN public.ambassador_referrals r ON r.id=e.referral_id JOIN public.profiles p ON p.id=r.establishment_id JOIN public.subscription_payments b ON b.id=e.payment_id),'[]'::jsonb),
 'payouts',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.ambassador_payouts t),'[]'::jsonb),
 'review',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'ambassador_id',r.ambassador_id,'business_name',s.business_name,'status',p.status,'plan_slug',p.ambassador_plan_slug)) FROM public.subscription_payments p JOIN public.ambassador_referrals r ON r.establishment_id=p.establishment_id JOIN public.profiles s ON s.id=p.establishment_id WHERE p.created_at>=r.created_at AND p.payment_source='asaas' AND p.status IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH') AND (public.ambassador_commission_rate(p.ambassador_plan_slug,false) IS NULL OR p.payment_date IS NULL OR (p.due_date IS NULL AND p.payment_date IS NULL))),'[]'::jsonb)
 );
END; $$;
REVOKE ALL ON FUNCTION public.admin_ambassador_report() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_ambassador_report() TO authenticated;