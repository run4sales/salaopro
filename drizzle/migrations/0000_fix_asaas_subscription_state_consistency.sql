CREATE OR REPLACE FUNCTION public.get_subscription_state(_establishment_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
  days_left numeric;
  days_overdue numeric;
  cycle_key text;
  has_active_grace boolean;
  grace_used_this_cycle boolean;
BEGIN
  SELECT status, trial_ends_at, next_billing_at, manual_blocked_at,
         grace_started_at, grace_ends_at, grace_cycle_key
    INTO s
  FROM public.subscriptions
  WHERE establishment_id = _establishment_id
  LIMIT 1;

  IF NOT FOUND THEN RETURN 'no_subscription'; END IF;
  IF s.manual_blocked_at IS NOT NULL THEN RETURN 'blocked_manual'; END IF;
  IF s.status IN ('canceled', 'blocked') THEN RETURN 'blocked'; END IF;

  has_active_grace := (s.grace_ends_at IS NOT NULL AND s.grace_ends_at > now());

  IF s.status = 'trial' THEN
    cycle_key := 'trial:' || COALESCE(s.trial_ends_at::text, 'none');
    grace_used_this_cycle := (s.grace_cycle_key = cycle_key);
    IF s.trial_ends_at IS NULL THEN RETURN 'trial_active'; END IF;
    days_left := EXTRACT(EPOCH FROM (s.trial_ends_at - now())) / 86400;
    IF days_left > 0 THEN
      IF days_left <= 3 THEN RETURN 'trial_expiring'; END IF;
      RETURN 'trial_active';
    END IF;
    days_overdue := -days_left;
    IF has_active_grace THEN RETURN 'grace_active'; END IF;
    IF days_overdue >= 10 OR grace_used_this_cycle THEN RETURN 'blocked'; END IF;
    RETURN 'trial_expired';
  END IF;

  IF s.status = 'active' THEN
    cycle_key := 'billing:' || COALESCE(s.next_billing_at::text, 'none');
    grace_used_this_cycle := (s.grace_cycle_key = cycle_key);
    IF s.next_billing_at IS NULL THEN RETURN 'active_paid'; END IF;
    days_left := EXTRACT(EPOCH FROM (s.next_billing_at - now())) / 86400;
    IF days_left > 0 THEN
      IF days_left <= 5 THEN RETURN 'payment_pending'; END IF;
      RETURN 'active_paid';
    END IF;
    days_overdue := -days_left;
    IF has_active_grace THEN RETURN 'grace_active'; END IF;
    IF days_overdue >= 3 OR grace_used_this_cycle THEN RETURN 'blocked'; END IF;
    IF days_overdue >= 1 THEN RETURN 'overdue'; END IF;
    RETURN 'payment_pending';
  END IF;

  IF s.status = 'past_due' THEN
    IF has_active_grace THEN RETURN 'grace_active'; END IF;
    RETURN 'overdue';
  END IF;
  RETURN s.status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_subscription_states()
RETURNS TABLE(establishment_id uuid, state text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT s.establishment_id, public.get_subscription_state(s.establishment_id)
  FROM public.subscriptions s;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_subscription_states() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_subscription_states() TO authenticated, service_role;