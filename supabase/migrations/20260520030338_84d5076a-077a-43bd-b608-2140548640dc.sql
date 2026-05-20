-- ===== Subscription plans catalog =====
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  monthly_price numeric NOT NULL DEFAULT 0,
  max_clients integer,
  max_users integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Subscriptions per establishment =====
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'trial',
  monthly_amount numeric NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz,
  next_billing_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions(plan_id);

-- ===== Admin actions audit log =====
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_establishment_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_log_target ON public.admin_actions_log(target_establishment_id);
CREATE INDEX IF NOT EXISTS idx_admin_log_created ON public.admin_actions_log(created_at DESC);

-- ===== Extend profiles with last_access tracking =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_access_at timestamptz;

-- ===== RLS =====
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans readable by authenticated"
  ON public.subscription_plans FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Super admins manage plans"
  ON public.subscription_plans FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishments can view their subscription"
  ON public.subscriptions FOR SELECT
  USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admins manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins read admin logs"
  ON public.admin_actions_log FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins insert admin logs"
  ON public.admin_actions_log FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND admin_user_id = auth.uid());

-- ===== Updated_at triggers =====
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Auto-create trial subscription on signup =====
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (establishment_id, status, trial_ends_at, monthly_amount)
  VALUES (NEW.id, 'trial', now() + interval '14 days', 0)
  ON CONFLICT (establishment_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_subscription_on_profile_insert ON public.profiles;
CREATE TRIGGER create_subscription_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_trial_subscription();

-- ===== Seed default plans =====
INSERT INTO public.subscription_plans (name, slug, monthly_price, max_clients, max_users, display_order, features) VALUES
  ('Essencial', 'essencial', 29, 200, 1, 1, '["Agenda básica","WhatsApp integrado","Relatórios básicos"]'::jsonb),
  ('Crescimento', 'crescimento', 59, 1000, 3, 2, '["Agenda avançada","Financeiro completo","Comissões automáticas","Suporte prioritário"]'::jsonb),
  ('Escala', 'escala', 99, NULL, NULL, 3, '["Clientes ilimitados","BI completo","API integração","Onboarding dedicado"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ===== Backfill subscriptions for existing profiles =====
INSERT INTO public.subscriptions (establishment_id, status, trial_ends_at, monthly_amount)
SELECT id, 'trial', now() + interval '14 days', 0
FROM public.profiles
ON CONFLICT (establishment_id) DO NOTHING;