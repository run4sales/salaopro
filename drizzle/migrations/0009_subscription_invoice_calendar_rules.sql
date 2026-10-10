ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_invoice_status text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_invoice_due_date date;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_invoice_url text;
CREATE OR REPLACE FUNCTION public.subscription_calendar_state(p_status text, p_trial_end timestamptz, p_created timestamptz, p_next_billing timestamptz, p_manual timestamptz, p_grace timestamptz, p_invoice_status text, p_invoice_due date, p_now timestamptz DEFAULT now())
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE days_left integer; deadline timestamptz;
BEGIN
 IF p_manual IS NOT NULL THEN RETURN 'blocked_manual'; END IF;
 IF p_status IN ('blocked','canceled') THEN RETURN 'blocked'; END IF;
 IF p_grace > p_now THEN RETURN 'grace_active'; END IF;
 IF p_status = 'trial' THEN
   deadline := COALESCE(p_trial_end, p_created + interval '10 days');
   IF deadline IS NULL OR deadline <= p_now THEN RETURN 'trial_expired'; END IF;
   IF deadline <= p_now + interval '3 days' THEN RETURN 'trial_expiring'; END IF;
   RETURN 'trial_active';
 END IF;
 IF p_status NOT IN ('active','past_due','pending') THEN RETURN 'blocked'; END IF;
 IF p_status = 'pending' AND p_trial_end > p_now THEN RETURN 'trial_active'; END IF;
 IF p_invoice_status IN ('PENDING','OVERDUE') AND p_invoice_due IS NOT NULL THEN
   deadline := (p_invoice_due::timestamp AT TIME ZONE 'America/Sao_Paulo');
   IF p_status <> 'active' AND p_next_billing IS NOT NULL THEN deadline := LEAST(deadline, p_next_billing); END IF;
 ELSE deadline := p_next_billing;
 END IF;
 IF deadline IS NULL THEN
   IF p_status = 'active' THEN RETURN 'active_paid'; END IF;
   RETURN 'blocked';
 END IF;
 days_left := (deadline AT TIME ZONE 'America/Sao_Paulo')::date - (p_now AT TIME ZONE 'America/Sao_Paulo')::date;
 IF days_left <= -3 THEN RETURN 'blocked'; END IF;
 IF days_left <= 3 THEN RETURN 'payment_pending'; END IF;
 IF p_status = 'active' THEN RETURN 'active_paid'; END IF;
 RETURN 'blocked';
END;
$$;
REVOKE ALL ON FUNCTION public.subscription_calendar_state(text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,text,date,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscription_calendar_state(text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,text,date,timestamptz) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.get_subscription_state(_establishment_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.subscriptions%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.subscriptions WHERE establishment_id = _establishment_id LIMIT 1;
 IF NOT FOUND THEN RETURN 'no_subscription'; END IF;
 RETURN public.subscription_calendar_state(s.status,s.trial_ends_at,s.created_at,s.next_billing_at,s.manual_blocked_at,s.grace_ends_at,s.current_invoice_status,s.current_invoice_due_date);
END;
$$;
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_my_subscription';
 IF definition IS NULL THEN RAISE EXCEPTION 'Subscription RPC missing'; END IF;
 definition := replace(definition, '''payment_link'', s.payment_link', '''payment_link'', COALESCE(s.current_invoice_url, s.payment_link), ''current_invoice_status'', s.current_invoice_status, ''current_invoice_due_date'', s.current_invoice_due_date');
 EXECUTE definition;
END;
$$;