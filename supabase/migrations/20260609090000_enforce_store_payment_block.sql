-- Enforce automatic/manual store blocking from trial age and Asaas paid subscription status.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS manual_blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_blocked_reason text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_manual_blocked
  ON public.subscriptions(manual_blocked_at)
  WHERE manual_blocked_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  selected_plan public.subscription_plans%ROWTYPE;
BEGIN
  SELECT sp.* INTO selected_plan
  FROM public.subscription_plans sp
  WHERE sp.slug = NEW.selected_plan_slug
    AND sp.active = true
  LIMIT 1;

  INSERT INTO public.subscriptions (establishment_id, plan_id, status, trial_ends_at, monthly_amount)
  VALUES (
    NEW.id,
    selected_plan.id,
    'trial',
    NEW.created_at + interval '10 days',
    coalesce(selected_plan.monthly_price, 0)
  )
  ON CONFLICT (establishment_id) DO UPDATE SET
    plan_id = coalesce(public.subscriptions.plan_id, EXCLUDED.plan_id),
    monthly_amount = CASE
      WHEN public.subscriptions.monthly_amount = 0 THEN EXCLUDED.monthly_amount
      ELSE public.subscriptions.monthly_amount
    END,
    trial_ends_at = coalesce(public.subscriptions.trial_ends_at, EXCLUDED.trial_ends_at),
    updated_at = now();
  RETURN NEW;
END;
$$;

UPDATE public.subscriptions s
SET trial_ends_at = p.created_at + interval '10 days',
    updated_at = now()
FROM public.profiles p
WHERE s.establishment_id = p.id
  AND s.status = 'trial'
  AND (
    s.trial_ends_at IS NULL
    OR s.trial_ends_at <> p.created_at + interval '10 days'
  );

CREATE OR REPLACE FUNCTION public.get_subscription_state(_establishment_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s RECORD;
  profile_created_at timestamptz;
  trial_ends_at timestamptz;
  days_left numeric;
BEGIN
  SELECT created_at INTO profile_created_at
  FROM public.profiles
  WHERE id = _establishment_id
  LIMIT 1;

  SELECT status, trial_ends_at, next_billing_at, asaas_subscription_id, last_payment_at, manual_blocked_at
    INTO s
  FROM public.subscriptions
  WHERE establishment_id = _establishment_id
  LIMIT 1;

  IF NOT FOUND THEN
    IF profile_created_at IS NOT NULL AND profile_created_at + interval '10 days' > now() THEN
      RETURN 'trial_active';
    END IF;
    RETURN 'no_subscription';
  END IF;

  IF s.manual_blocked_at IS NOT NULL OR s.status = 'blocked' THEN
    RETURN 'blocked';
  END IF;

  IF s.status = 'canceled' THEN
    RETURN 'blocked';
  END IF;

  trial_ends_at := coalesce(profile_created_at + interval '10 days', s.trial_ends_at);

  IF s.status = 'active'
     AND s.asaas_subscription_id IS NOT NULL
     AND s.last_payment_at IS NOT NULL THEN
    IF s.next_billing_at IS NULL OR s.next_billing_at > now() THEN
      IF s.next_billing_at IS NOT NULL THEN
        days_left := EXTRACT(EPOCH FROM (s.next_billing_at - now())) / 86400;
        IF days_left <= 5 THEN RETURN 'payment_pending'; END IF;
      END IF;
      RETURN 'active_paid';
    END IF;
  END IF;

  IF trial_ends_at IS NOT NULL AND trial_ends_at > now() THEN
    days_left := EXTRACT(EPOCH FROM (trial_ends_at - now())) / 86400;
    IF days_left <= 3 THEN RETURN 'trial_expiring'; END IF;
    RETURN 'trial_active';
  END IF;

  RETURN 'overdue_blocked';
END;
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_subscription_state(_establishment_id) IN ('trial_active','trial_expiring','active_paid','payment_pending');
$$;

CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  est_id uuid;
  s RECORD;
  p RECORD;
  plan_json json;
  state text;
  sub_found boolean;
  profile_created_at timestamptz;
BEGIN
  SELECT id, created_at INTO est_id, profile_created_at FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  IF est_id IS NULL THEN
    SELECT eu.establishment_id, pr.created_at INTO est_id, profile_created_at
    FROM public.establishment_users eu
    JOIN public.profiles pr ON pr.id = eu.establishment_id
    WHERE eu.user_id = auth.uid() AND eu.active = true
    LIMIT 1;
  END IF;

  IF est_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO s FROM public.subscriptions WHERE establishment_id = est_id LIMIT 1;
  sub_found := FOUND;
  state := public.get_subscription_state(est_id);

  IF NOT sub_found THEN
    RETURN json_build_object(
      'establishment_id', est_id,
      'state', state,
      'status', 'missing',
      'plan_id', NULL,
      'plan', NULL,
      'created_at', profile_created_at,
      'trial_ends_at', profile_created_at + interval '10 days',
      'next_billing_at', NULL,
      'last_payment_at', NULL,
      'asaas_subscription_id', NULL,
      'manual_blocked_at', NULL,
      'monthly_amount', 0,
      'payment_link', NULL
    );
  END IF;

  IF s.plan_id IS NOT NULL THEN
    SELECT id, slug, name, monthly_price, max_clients, max_users INTO p
    FROM public.subscription_plans WHERE id = s.plan_id;
    IF FOUND THEN
      plan_json := json_build_object(
        'id', p.id, 'slug', p.slug, 'name', p.name,
        'monthly_price', p.monthly_price,
        'max_clients', p.max_clients, 'max_users', p.max_users
      );
    END IF;
  END IF;

  RETURN json_build_object(
    'establishment_id', est_id,
    'state', state,
    'status', s.status,
    'plan_id', s.plan_id,
    'plan', plan_json,
    'created_at', profile_created_at,
    'trial_ends_at', coalesce(profile_created_at + interval '10 days', s.trial_ends_at),
    'next_billing_at', s.next_billing_at,
    'last_payment_at', s.last_payment_at,
    'asaas_subscription_id', s.asaas_subscription_id,
    'manual_blocked_at', s.manual_blocked_at,
    'monthly_amount', coalesce(s.monthly_amount, 0),
    'payment_link', s.payment_link
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_subscription() TO authenticated;

NOTIFY pgrst, 'reload schema';
