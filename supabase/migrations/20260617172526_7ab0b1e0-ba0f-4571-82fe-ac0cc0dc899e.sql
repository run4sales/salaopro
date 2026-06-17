
-- 1. Novas colunas para liberação temporária
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS grace_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_cycle_key text;

-- 2. Atualiza get_subscription_state com novas regras
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

  IF NOT FOUND THEN
    RETURN 'no_subscription';
  END IF;

  -- Bloqueio manual sempre prevalece
  IF s.manual_blocked_at IS NOT NULL THEN RETURN 'blocked_manual'; END IF;
  IF s.status = 'canceled' THEN RETURN 'blocked'; END IF;
  IF s.status = 'blocked'  THEN RETURN 'blocked'; END IF;

  has_active_grace := (s.grace_ends_at IS NOT NULL AND s.grace_ends_at > now());

  -- ============== TRIAL ==============
  IF s.status = 'trial' THEN
    cycle_key := 'trial:' || COALESCE(s.trial_ends_at::text, 'none');
    grace_used_this_cycle := (s.grace_cycle_key = cycle_key);

    IF s.trial_ends_at IS NULL THEN RETURN 'trial_active'; END IF;
    days_left := EXTRACT(EPOCH FROM (s.trial_ends_at - now())) / 86400;

    IF days_left > 0 THEN
      -- Trial ativo (com ou sem countdown perto do fim)
      IF days_left <= 3 THEN RETURN 'trial_expiring'; END IF;
      RETURN 'trial_active';
    END IF;

    -- Trial vencido
    days_overdue := -days_left;

    IF has_active_grace THEN RETURN 'grace_active'; END IF;

    -- Mais de 10 dias vencido sem assinatura ativa -> bloqueio total
    IF days_overdue >= 10 THEN RETURN 'blocked'; END IF;

    -- Já usou a liberação neste ciclo de trial -> bloqueia
    IF grace_used_this_cycle THEN RETURN 'blocked'; END IF;

    -- Trial vencido mas pode liberar 48h
    RETURN 'trial_expired';
  END IF;

  -- ============== ACTIVE / PAGO ==============
  IF s.status = 'active' THEN
    cycle_key := 'billing:' || COALESCE(s.next_billing_at::text, 'none');
    grace_used_this_cycle := (s.grace_cycle_key = cycle_key);

    IF s.next_billing_at IS NULL THEN RETURN 'active_paid'; END IF;
    days_left := EXTRACT(EPOCH FROM (s.next_billing_at - now())) / 86400;

    IF days_left > 0 THEN
      IF days_left <= 5 THEN RETURN 'payment_pending'; END IF;
      RETURN 'active_paid';
    END IF;

    -- Pagamento vencido
    days_overdue := -days_left;

    IF has_active_grace THEN RETURN 'grace_active'; END IF;

    -- >72h vencido sem confirmação -> bloqueio total
    IF days_overdue >= 3 THEN RETURN 'blocked'; END IF;

    -- Já usou a liberação neste ciclo -> bloqueia
    IF grace_used_this_cycle THEN RETURN 'blocked'; END IF;

    -- Vencido há 1+ dia -> oferece liberação
    IF days_overdue >= 1 THEN RETURN 'overdue'; END IF;

    -- Vencido < 1 dia -> só aviso de pendente
    RETURN 'payment_pending';
  END IF;

  IF s.status = 'past_due' THEN RETURN 'overdue'; END IF;
  RETURN s.status;
END;
$function$;

-- 3. Atualiza has_active_subscription para considerar grace
CREATE OR REPLACE FUNCTION public.has_active_subscription(_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.get_subscription_state(_establishment_id) NOT IN (
    'overdue','blocked','blocked_manual','no_subscription','trial_expired'
  );
$function$;

-- 4. Atualiza get_my_subscription para devolver grace_ends_at
CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  est_id uuid;
  s RECORD;
  p RECORD;
  state text;
BEGIN
  SELECT id INTO est_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  IF est_id IS NULL THEN
    SELECT establishment_id INTO est_id
    FROM public.establishment_users
    WHERE user_id = auth.uid() AND active = true
    LIMIT 1;
  END IF;

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
    'monthly_amount', s.monthly_amount,
    'grace_started_at', s.grace_started_at,
    'grace_ends_at', s.grace_ends_at,
    'manual_blocked_at', s.manual_blocked_at,
    'asaas_subscription_id', s.asaas_subscription_id,
    'last_payment_at', s.last_payment_at,
    'payment_link', s.payment_link
  );
END;
$function$;

-- 5. RPC para o usuário solicitar a liberação de 48h
CREATE OR REPLACE FUNCTION public.request_grace_unlock()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  est_id uuid;
  s RECORD;
  current_state text;
  cycle_key text;
  new_ends timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id INTO est_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF est_id IS NULL THEN
    RAISE EXCEPTION 'Apenas o proprietário pode liberar acesso temporário';
  END IF;

  SELECT * INTO s FROM public.subscriptions WHERE establishment_id = est_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assinatura não encontrada'; END IF;

  IF s.manual_blocked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Acesso bloqueado pelo administrador. Entre em contato com o suporte.';
  END IF;

  current_state := public.get_subscription_state(est_id);

  IF current_state NOT IN ('trial_expired','overdue') THEN
    RAISE EXCEPTION 'Liberação temporária não está disponível no momento (estado: %)', current_state;
  END IF;

  IF s.status = 'trial' THEN
    cycle_key := 'trial:' || COALESCE(s.trial_ends_at::text, 'none');
  ELSE
    cycle_key := 'billing:' || COALESCE(s.next_billing_at::text, 'none');
  END IF;

  new_ends := now() + interval '48 hours';

  UPDATE public.subscriptions
     SET grace_started_at = now(),
         grace_ends_at = new_ends,
         grace_cycle_key = cycle_key,
         updated_at = now()
   WHERE establishment_id = est_id;

  RETURN json_build_object(
    'ok', true,
    'grace_started_at', now(),
    'grace_ends_at', new_ends
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.request_grace_unlock() FROM public;
GRANT EXECUTE ON FUNCTION public.request_grace_unlock() TO authenticated;
