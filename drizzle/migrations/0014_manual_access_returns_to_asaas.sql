CREATE OR REPLACE FUNCTION public.guard_manual_subscription_authorization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 is_manual boolean := coalesce(current_setting('app.manual_subscription_write', true),'') = 'on' AND public.has_role(auth.uid(),'super_admin');
 today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
 provider_paid boolean;
BEGIN
 IF NOT is_manual AND (NEW.manual_access_due_date IS DISTINCT FROM OLD.manual_access_due_date OR NEW.manual_access_status IS DISTINCT FROM OLD.manual_access_status OR NEW.manual_access_updated_at IS DISTINCT FROM OLD.manual_access_updated_at) THEN
  RAISE EXCEPTION 'Use a operação administrativa para alterar a autorização manual';
 END IF;
 IF NOT is_manual AND auth.role() = 'service_role' THEN
  IF NEW.next_billing_at IS DISTINCT FROM OLD.next_billing_at THEN NEW.provider_next_billing_at := NEW.next_billing_at; END IF;
  IF OLD.manual_access_due_date IS NOT NULL THEN
   provider_paid := NEW.current_invoice_status IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH');
   -- An expired authorization, or a provider payment while the manual state does not grant access,
   -- hands control back to the provider so paid invoices unlock the salon again.
   IF OLD.manual_access_due_date < today OR (provider_paid AND coalesce(OLD.manual_access_status,'') NOT IN ('active','trial')) THEN
    NEW.manual_access_due_date := NULL;
    NEW.manual_access_status := NULL;
    NEW.manual_access_updated_at := now();
    IF NEW.next_billing_at IS NOT DISTINCT FROM OLD.next_billing_at THEN
     NEW.next_billing_at := coalesce(OLD.provider_next_billing_at, OLD.next_billing_at);
    END IF;
    IF provider_paid AND NEW.status IN ('pending','past_due','trial') THEN NEW.status := 'active'; END IF;
   ELSE
    NEW.status := OLD.status; NEW.next_billing_at := OLD.next_billing_at;
    NEW.monthly_amount := OLD.monthly_amount; NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.canceled_at := OLD.canceled_at; NEW.grace_started_at := OLD.grace_started_at; NEW.grace_ends_at := OLD.grace_ends_at; NEW.grace_cycle_key := OLD.grace_cycle_key;
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_manual_subscription_authorization() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_manual_subscription_authorization() TO service_role;

CREATE OR REPLACE FUNCTION public.get_subscription_state(_establishment_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions%ROWTYPE; provider_paid boolean;
BEGIN
 SELECT * INTO s FROM public.subscriptions WHERE establishment_id=_establishment_id LIMIT 1;
 IF NOT FOUND THEN RETURN 'no_subscription'; END IF;
 provider_paid := s.current_invoice_status IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH');
 IF s.manual_access_due_date IS NOT NULL THEN
  -- Manual authorization governs only while its date is valid and no provider payment supersedes a non-granting manual state.
  IF s.manual_access_due_date >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
     AND NOT (provider_paid AND coalesce(s.manual_access_status,'') NOT IN ('active','trial')) THEN
   RETURN public.subscription_calendar_state(s.manual_access_status,
    CASE WHEN s.manual_access_status='trial' THEN (s.manual_access_due_date::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' ELSE s.trial_ends_at END,
    s.created_at,s.manual_access_due_date::timestamp AT TIME ZONE 'America/Sao_Paulo',s.manual_blocked_at,s.grace_ends_at,NULL,NULL);
  END IF;
  -- Expired or superseded: follow the provider snapshot.
  RETURN public.subscription_calendar_state(
   CASE WHEN provider_paid AND s.status IN ('pending','past_due','trial') THEN 'active' ELSE s.status END,
   s.trial_ends_at,s.created_at,coalesce(s.provider_next_billing_at,s.next_billing_at),s.manual_blocked_at,s.grace_ends_at,s.current_invoice_status,s.current_invoice_due_date);
 END IF;
 RETURN public.subscription_calendar_state(s.status,s.trial_ends_at,s.created_at,s.next_billing_at,s.manual_blocked_at,s.grace_ends_at,s.current_invoice_status,s.current_invoice_due_date);
END $$;