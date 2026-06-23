CREATE OR REPLACE FUNCTION public.create_trial_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meta jsonb;
  v_slug text;
  v_plan RECORD;
BEGIN
  -- Tenta ler o plano escolhido no cadastro a partir do metadata do usuário
  SELECT raw_user_meta_data INTO v_meta FROM auth.users WHERE id = NEW.user_id;
  v_slug := NULLIF(v_meta ->> 'selected_plan', '');

  IF v_slug IS NOT NULL THEN
    SELECT id, monthly_price INTO v_plan
    FROM public.subscription_plans
    WHERE slug = v_slug AND active = true
    LIMIT 1;
  END IF;

  IF v_plan.id IS NULL THEN
    -- Fallback: pega o plano "profissional" se existir, ou qualquer ativo
    SELECT id, monthly_price INTO v_plan
    FROM public.subscription_plans
    WHERE active = true
    ORDER BY CASE WHEN slug = 'profissional' THEN 0 ELSE 1 END, display_order
    LIMIT 1;
  END IF;

  INSERT INTO public.subscriptions (establishment_id, status, trial_ends_at, monthly_amount, plan_id)
  VALUES (
    NEW.id,
    'trial',
    now() + interval '10 days',
    COALESCE(v_plan.monthly_price, 0),
    v_plan.id
  )
  ON CONFLICT (establishment_id) DO UPDATE
    SET plan_id = COALESCE(public.subscriptions.plan_id, EXCLUDED.plan_id),
        monthly_amount = CASE
          WHEN public.subscriptions.plan_id IS NULL THEN EXCLUDED.monthly_amount
          ELSE public.subscriptions.monthly_amount
        END;

  RETURN NEW;
END;
$function$;

-- Retroativo: associa o plano escolhido no cadastro às assinaturas que ainda estão sem plano
UPDATE public.subscriptions s
SET plan_id = sp.id,
    monthly_amount = sp.monthly_price
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
JOIN public.subscription_plans sp
  ON sp.slug = NULLIF(u.raw_user_meta_data ->> 'selected_plan', '')
 AND sp.active = true
WHERE s.establishment_id = p.id
  AND s.plan_id IS NULL;

-- Fallback: assinaturas ainda sem plano recebem o "profissional"
UPDATE public.subscriptions s
SET plan_id = sp.id,
    monthly_amount = sp.monthly_price
FROM public.subscription_plans sp
WHERE s.plan_id IS NULL
  AND sp.slug = 'profissional'
  AND sp.active = true;