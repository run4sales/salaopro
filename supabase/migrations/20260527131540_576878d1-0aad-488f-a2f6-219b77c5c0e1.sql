
-- 1) Trial passes from 14 to 10 days
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.subscriptions (establishment_id, status, trial_ends_at, monthly_amount)
  VALUES (NEW.id, 'trial', now() + interval '10 days', 0)
  ON CONFLICT (establishment_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists on profiles
DROP TRIGGER IF EXISTS trg_create_trial_subscription ON public.profiles;
CREATE TRIGGER trg_create_trial_subscription
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.create_trial_subscription();

-- 2) Make sure subscription_plans.slug is unique so seeding is idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_slug_key'
  ) THEN
    ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 3) Seed default plans
INSERT INTO public.subscription_plans (slug, name, monthly_price, max_clients, max_users, active, display_order, features)
VALUES
  ('individual', 'Individual', 59.90, 1000, 1, true, 1,
   '["Agenda avançada","Comissões automáticas","Relatórios avançados"]'::jsonb),
  ('empresa', 'Empresa', 109.90, NULL, 20, true, 2,
   '["Agenda avançada","Comissões automáticas","Relatórios avançados","Suporte prioritário","Integração WhatsApp"]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price = EXCLUDED.monthly_price,
  max_clients = EXCLUDED.max_clients,
  max_users = EXCLUDED.max_users,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order,
  active = true;

-- 4) Compute subscription state for a given establishment
CREATE OR REPLACE FUNCTION public.get_subscription_state(_establishment_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s RECORD;
  days_left numeric;
  days_overdue numeric;
BEGIN
  SELECT status, trial_ends_at, next_billing_at
    INTO s
  FROM public.subscriptions
  WHERE establishment_id = _establishment_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'no_subscription';
  END IF;

  IF s.status = 'canceled' THEN RETURN 'blocked'; END IF;
  IF s.status = 'blocked'  THEN RETURN 'blocked'; END IF;

  IF s.status = 'trial' THEN
    IF s.trial_ends_at IS NULL THEN RETURN 'trial_active'; END IF;
    days_left := EXTRACT(EPOCH FROM (s.trial_ends_at - now())) / 86400;
    IF days_left <= 0 THEN
      days_overdue := -days_left;
      IF days_overdue >= 7 THEN RETURN 'overdue_blocked'; END IF;
      IF days_overdue >= 3 THEN RETURN 'overdue_partial'; END IF;
      RETURN 'overdue';
    END IF;
    IF days_left <= 3 THEN RETURN 'trial_expiring'; END IF;
    RETURN 'trial_active';
  END IF;

  IF s.status = 'active' THEN
    IF s.next_billing_at IS NULL THEN RETURN 'active_paid'; END IF;
    days_left := EXTRACT(EPOCH FROM (s.next_billing_at - now())) / 86400;
    IF days_left <= 0 THEN
      days_overdue := -days_left;
      IF days_overdue >= 7 THEN RETURN 'overdue_blocked'; END IF;
      IF days_overdue >= 3 THEN RETURN 'overdue_partial'; END IF;
      RETURN 'overdue';
    END IF;
    IF days_left <= 5 THEN RETURN 'payment_pending'; END IF;
    RETURN 'active_paid';
  END IF;

  IF s.status = 'past_due' THEN RETURN 'overdue_partial'; END IF;

  RETURN s.status;
END;
$$;

-- 5) Whether the establishment can still create resources
CREATE OR REPLACE FUNCTION public.has_active_subscription(_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_subscription_state(_establishment_id) NOT IN ('overdue_partial','overdue_blocked','blocked','no_subscription');
$$;

-- 6) Restrictive policies blocking new appointments / clients when overdue
DROP POLICY IF EXISTS "Block new appointments when overdue" ON public.appointments;
CREATE POLICY "Block new appointments when overdue"
ON public.appointments AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_active_subscription(establishment_id));

DROP POLICY IF EXISTS "Block new clients when overdue" ON public.clients;
CREATE POLICY "Block new clients when overdue"
ON public.clients AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_active_subscription(establishment_id));

-- 7) Enforce plan client limit (Individual = 1000)
CREATE OR REPLACE FUNCTION public.enforce_plan_client_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max int;
  v_count int;
BEGIN
  SELECT sp.max_clients INTO v_max
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.establishment_id = NEW.establishment_id
  LIMIT 1;

  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.clients WHERE establishment_id = NEW.establishment_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Limite de % clientes atingido no seu plano. Faça upgrade para o plano Empresa.', v_max
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_plan_client_limit ON public.clients;
CREATE TRIGGER trg_enforce_plan_client_limit
BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_client_limit();

-- 8) Helper to read current establishment subscription with computed state
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
  state text;
BEGIN
  SELECT id INTO est_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF est_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO s FROM public.subscriptions WHERE establishment_id = est_id LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('state', 'no_subscription', 'establishment_id', est_id); END IF;

  state := public.get_subscription_state(est_id);

  IF s.plan_id IS NOT NULL THEN
    SELECT id, slug, name, monthly_price, max_clients, max_users INTO p
    FROM public.subscription_plans WHERE id = s.plan_id;
  END IF;

  RETURN json_build_object(
    'establishment_id', est_id,
    'state', state,
    'status', s.status,
    'plan_id', s.plan_id,
    'plan', CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object(
      'id', p.id, 'slug', p.slug, 'name', p.name,
      'monthly_price', p.monthly_price,
      'max_clients', p.max_clients, 'max_users', p.max_users
    ) END,
    'trial_ends_at', s.trial_ends_at,
    'next_billing_at', s.next_billing_at,
    'monthly_amount', s.monthly_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;
