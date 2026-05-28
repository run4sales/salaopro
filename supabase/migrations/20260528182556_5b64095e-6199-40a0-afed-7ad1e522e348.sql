
-- 1) Upsert os 3 planos oficiais
INSERT INTO public.subscription_plans (slug, name, monthly_price, max_clients, max_users, active, display_order, features)
VALUES
  ('individual',   'Individual',   29.90, 300,  1,  true, 1, '["Agenda inteligente","Comissões automáticas","Relatórios completos"]'::jsonb),
  ('profissional', 'Profissional', 69.90, NULL, 4,  true, 2, '["Mais popular","Clientes ilimitados","Equipe de até 4 usuários","Agenda inteligente","Comissões automáticas","Relatórios avançados"]'::jsonb),
  ('empresa',      'Empresa',     109.90, NULL, 20, true, 3, '["Clientes ilimitados","Equipe de até 20 usuários","Agenda inteligente","Comissões automáticas","Relatórios avançados","Suporte prioritário"]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price = EXCLUDED.monthly_price,
  max_clients = EXCLUDED.max_clients,
  max_users = EXCLUDED.max_users,
  active = true,
  display_order = EXCLUDED.display_order,
  features = EXCLUDED.features,
  updated_at = now();

-- Desativa demais planos que não fazem parte da nova oferta
UPDATE public.subscription_plans SET active = false
WHERE slug NOT IN ('individual','profissional','empresa');

-- 2) Novas colunas em subscriptions para troca de plano agendada (downgrade)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_id uuid REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS pending_plan_effective_at timestamptz;

-- 3) Trigger para limite de usuários por plano
CREATE OR REPLACE FUNCTION public.enforce_plan_user_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
  v_count int;
BEGIN
  -- só conta novos ativos
  IF NEW.active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT sp.max_users INTO v_max
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.establishment_id = NEW.establishment_id
  LIMIT 1;

  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.establishment_users
    WHERE establishment_id = NEW.establishment_id
      AND active = true
      AND (TG_OP = 'INSERT' OR id <> NEW.id);

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Limite de % usuários atingido no seu plano. Faça upgrade para adicionar mais usuários.', v_max
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_plan_user_limit_trg ON public.establishment_users;
CREATE TRIGGER enforce_plan_user_limit_trg
BEFORE INSERT OR UPDATE OF active ON public.establishment_users
FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_user_limit();
