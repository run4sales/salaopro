ALTER TABLE public.subscriptions ADD COLUMN manual_access_due_date date, ADD COLUMN manual_access_status text, ADD COLUMN manual_access_updated_at timestamptz, ADD COLUMN provider_next_billing_at timestamptz;
ALTER TABLE public.subscription_payments ADD COLUMN manual_request_id uuid, ADD COLUMN payment_source text NOT NULL DEFAULT 'asaas';
CREATE UNIQUE INDEX subscription_payments_manual_request_unique ON public.subscription_payments(manual_request_id) WHERE manual_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_manual_subscription_authorization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE is_manual boolean := coalesce(current_setting('app.manual_subscription_write', true),'') = 'on' AND public.has_role(auth.uid(),'super_admin');
BEGIN
 IF NOT is_manual AND (NEW.manual_access_due_date IS DISTINCT FROM OLD.manual_access_due_date OR NEW.manual_access_status IS DISTINCT FROM OLD.manual_access_status OR NEW.manual_access_updated_at IS DISTINCT FROM OLD.manual_access_updated_at) THEN
  RAISE EXCEPTION 'Use a operação administrativa para alterar a autorização manual';
 END IF;
 IF NOT is_manual AND auth.role() = 'service_role' THEN
  IF NEW.next_billing_at IS DISTINCT FROM OLD.next_billing_at THEN NEW.provider_next_billing_at := NEW.next_billing_at; END IF;
  IF OLD.manual_access_due_date IS NOT NULL THEN
   NEW.status := OLD.status; NEW.next_billing_at := OLD.next_billing_at;
   NEW.monthly_amount := OLD.monthly_amount; NEW.trial_ends_at := OLD.trial_ends_at;
   NEW.canceled_at := OLD.canceled_at; NEW.grace_started_at := OLD.grace_started_at; NEW.grace_ends_at := OLD.grace_ends_at; NEW.grace_cycle_key := OLD.grace_cycle_key;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_manual_subscription_authorization BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.guard_manual_subscription_authorization();
REVOKE ALL ON FUNCTION public.guard_manual_subscription_authorization() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_manual_subscription_authorization() TO service_role;

CREATE OR REPLACE FUNCTION public.get_subscription_state(_establishment_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.subscriptions WHERE establishment_id=_establishment_id LIMIT 1;
 IF NOT FOUND THEN RETURN 'no_subscription'; END IF;
 IF s.manual_access_due_date IS NOT NULL THEN
  RETURN public.subscription_calendar_state(s.manual_access_status,
   CASE WHEN s.manual_access_status='trial' THEN (s.manual_access_due_date::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' ELSE s.trial_ends_at END,
   s.created_at,s.manual_access_due_date::timestamp AT TIME ZONE 'America/Sao_Paulo',s.manual_blocked_at,s.grace_ends_at,NULL,NULL);
 END IF;
 RETURN public.subscription_calendar_state(s.status,s.trial_ends_at,s.created_at,s.next_billing_at,s.manual_blocked_at,s.grace_ends_at,s.current_invoice_status,s.current_invoice_due_date);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_subscription_authorization(p_establishment uuid, p_action text, p_due_date date DEFAULT NULL, p_amount numeric DEFAULT NULL, p_payment_date date DEFAULT NULL, p_request_id uuid DEFAULT NULL, p_plan_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions%ROWTYPE; result public.subscriptions%ROWTYPE; actor uuid := auth.uid(); payment_id uuid; new_status text;
BEGIN
 IF actor IS NULL OR NOT public.has_role(actor,'super_admin') THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('grant','paid','trial','pending','block','cancel','automatic','plan') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
 SELECT * INTO s FROM public.subscriptions WHERE establishment_id=p_establishment FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assinatura não encontrada'; END IF;
 IF p_action IN ('grant','paid','trial','pending','plan') AND p_due_date IS NULL THEN RAISE EXCEPTION 'Informe a data de vencimento autorizada'; END IF;
 IF p_amount IS NOT NULL AND p_amount < 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
 IF p_action='paid' AND (p_amount IS NULL OR p_amount<=0 OR p_payment_date IS NULL OR p_payment_date > (now() AT TIME ZONE 'America/Sao_Paulo')::date OR p_request_id IS NULL) THEN RAISE EXCEPTION 'Informe valor, data válida do pagamento e identificação da operação'; END IF;
 IF p_action='plan' AND (p_plan_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.subscription_plans WHERE id=p_plan_id AND active)) THEN RAISE EXCEPTION 'Plano inválido'; END IF;
 IF p_action='paid' THEN
  SELECT id INTO payment_id FROM public.subscription_payments WHERE manual_request_id=p_request_id;
  IF FOUND THEN
   IF NOT EXISTS(SELECT 1 FROM public.subscription_payments WHERE id=payment_id AND establishment_id=p_establishment AND value=p_amount AND payment_date=(p_payment_date::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '12 hours') THEN RAISE EXCEPTION 'Operação já utilizada com outros dados'; END IF;
   RETURN jsonb_build_object('state',public.get_subscription_state(p_establishment),'payment_id',payment_id,'recovered',true);
  END IF;
 END IF;
 PERFORM set_config('app.manual_subscription_write','on',true);
 IF p_action='automatic' THEN
  new_status := CASE WHEN s.current_invoice_status IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH') THEN 'active' WHEN s.current_invoice_status IN ('PENDING','OVERDUE') THEN 'past_due' WHEN s.current_invoice_status IN ('DELETED','CANCELED','REFUNDED') THEN 'canceled' ELSE 'pending' END;
  UPDATE public.subscriptions SET manual_access_due_date=NULL,manual_access_status=NULL,manual_access_updated_at=now(),status=new_status,
   next_billing_at=coalesce(provider_next_billing_at,current_invoice_due_date::timestamp AT TIME ZONE 'America/Sao_Paulo'),manual_blocked_at=NULL,manual_blocked_reason=NULL,
   grace_started_at=NULL,grace_ends_at=NULL,grace_cycle_key=NULL WHERE id=s.id RETURNING * INTO result;
 ELSE
  new_status := CASE p_action WHEN 'paid' THEN 'active' WHEN 'trial' THEN 'trial' WHEN 'pending' THEN 'past_due' WHEN 'block' THEN 'blocked' WHEN 'cancel' THEN 'canceled' ELSE CASE WHEN s.status='active' THEN 'active' ELSE 'pending' END END;
  UPDATE public.subscriptions SET status=new_status,
   manual_access_due_date=CASE WHEN p_action IN ('block','cancel') THEN NULL ELSE p_due_date END,
   manual_access_status=CASE WHEN p_action IN ('block','cancel') THEN NULL WHEN p_action IN ('grant','plan','paid') THEN 'active' ELSE new_status END,
   manual_access_updated_at=now(),
   provider_next_billing_at=coalesce(provider_next_billing_at,next_billing_at),
   next_billing_at=CASE WHEN p_due_date IS NOT NULL THEN (p_due_date::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '12 hours' ELSE next_billing_at END,
   monthly_amount=coalesce(p_amount,monthly_amount),plan_id=coalesce(p_plan_id,plan_id),
   trial_ends_at=CASE WHEN p_action='trial' THEN (p_due_date::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' ELSE NULL END,
   manual_blocked_at=CASE WHEN p_action IN ('block','cancel') THEN now() ELSE NULL END,
   manual_blocked_reason=CASE WHEN p_action IN ('block','cancel') THEN 'Bloqueio administrativo' ELSE NULL END,
   canceled_at=CASE WHEN p_action IN ('block','cancel') THEN now() ELSE NULL END,
   grace_started_at=NULL,grace_ends_at=NULL,grace_cycle_key=NULL,
   last_payment_at=CASE WHEN p_action='paid' THEN (p_payment_date::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '12 hours' ELSE last_payment_at END
  WHERE id=s.id RETURNING * INTO result;
 END IF;
 IF p_action='paid' THEN
  INSERT INTO public.subscription_payments(establishment_id,subscription_id,value,status,billing_type,due_date,payment_date,manual_request_id,payment_source,raw)
  VALUES(p_establishment,s.id,p_amount,'RECEIVED_IN_CASH','MANUAL',p_due_date,(p_payment_date::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '12 hours',p_request_id,'manual',jsonb_build_object('recorded_by',actor,'source','manual')) RETURNING id INTO payment_id;
 END IF;
 INSERT INTO public.admin_actions_log(admin_user_id,action,target_establishment_id,details)
 VALUES(actor,'manual_subscription_'||p_action,p_establishment,jsonb_build_object('before',to_jsonb(s),'after',to_jsonb(result),'payment_id',payment_id));
 PERFORM set_config('app.manual_subscription_write','off',true);
 RETURN jsonb_build_object('state',public.get_subscription_state(p_establishment),'payment_id',payment_id);
END $$;
REVOKE ALL ON FUNCTION public.admin_set_subscription_authorization(uuid,text,date,numeric,date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_authorization(uuid,text,date,numeric,date,uuid,uuid) TO authenticated;
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_my_subscription';
 IF definition IS NULL THEN RAISE EXCEPTION 'Subscription RPC missing'; END IF;
 definition:=replace(definition,'''monthly_amount'', s.monthly_amount','''manual_access_due_date'', s.manual_access_due_date, ''manual_access_status'', s.manual_access_status, ''monthly_amount'', s.monthly_amount');
 EXECUTE definition;
END $$;