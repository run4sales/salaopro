-- Store the plan selected during signup and create trial subscriptions with that plan.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_plan_slug text;

-- Backfill the selected plan from auth metadata for companies created before this migration.
UPDATE public.profiles p
SET selected_plan_slug = NULLIF(u.raw_user_meta_data ->> 'selected_plan', '')
FROM auth.users u
WHERE p.user_id = u.id
  AND p.selected_plan_slug IS NULL
  AND NULLIF(u.raw_user_meta_data ->> 'selected_plan', '') IS NOT NULL;

-- Keep only slugs that exist in the current plan catalog.
UPDATE public.profiles p
SET selected_plan_slug = NULL
WHERE selected_plan_slug IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.subscription_plans sp WHERE sp.slug = p.selected_plan_slug
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o usuário foi criado como staff de um salão existente, NÃO criar novo salão/role de establishment.
  IF coalesce((new.raw_user_meta_data ->> 'is_staff')::boolean, false) = true THEN
    RETURN new;
  END IF;

  INSERT INTO public.profiles (
    user_id, business_name, document, owner_name, phone, email,
    cep, street, neighborhood, city, business_type, selected_plan_slug
  )
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'Meu Salão'),
    coalesce(nullif(new.raw_user_meta_data ->> 'document', ''), 'PENDENTE'),
    coalesce(new.raw_user_meta_data ->> 'owner_name', new.raw_user_meta_data ->> 'full_name', 'Proprietário'),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone, ''),
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'cep', ''), 'PENDENTE'),
    coalesce(nullif(new.raw_user_meta_data ->> 'street', ''), 'PENDENTE'),
    coalesce(nullif(new.raw_user_meta_data ->> 'neighborhood', ''), 'PENDENTE'),
    coalesce(nullif(new.raw_user_meta_data ->> 'city', ''), 'PENDENTE'),
    coalesce(nullif(new.raw_user_meta_data ->> 'business_type', ''), 'Salao de beleza'),
    nullif(new.raw_user_meta_data ->> 'selected_plan', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'establishment')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$function$;

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
    now() + interval '10 days',
    coalesce(selected_plan.monthly_price, 0)
  )
  ON CONFLICT (establishment_id) DO UPDATE SET
    plan_id = coalesce(public.subscriptions.plan_id, EXCLUDED.plan_id),
    monthly_amount = CASE
      WHEN public.subscriptions.monthly_amount = 0 THEN EXCLUDED.monthly_amount
      ELSE public.subscriptions.monthly_amount
    END,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Backfill subscriptions missing a plan/amount from the selected signup plan.
UPDATE public.subscriptions s
SET
  plan_id = coalesce(s.plan_id, sp.id),
  monthly_amount = CASE WHEN s.monthly_amount = 0 THEN sp.monthly_price ELSE s.monthly_amount END,
  updated_at = now()
FROM public.profiles p
JOIN public.subscription_plans sp ON sp.slug = p.selected_plan_slug
WHERE s.establishment_id = p.id
  AND (s.plan_id IS NULL OR s.monthly_amount = 0);

-- Ensure every company has at least a trial subscription, even if an older trigger failed.
INSERT INTO public.subscriptions (establishment_id, plan_id, status, trial_ends_at, monthly_amount)
SELECT p.id, sp.id, 'trial', now() + interval '10 days', coalesce(sp.monthly_price, 0)
FROM public.profiles p
LEFT JOIN public.subscription_plans sp ON sp.slug = p.selected_plan_slug
ON CONFLICT (establishment_id) DO NOTHING;
