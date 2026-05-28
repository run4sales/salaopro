CREATE TABLE IF NOT EXISTS public.establishment_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','employee')),
  professional_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_eu_user ON public.establishment_users(user_id);
CREATE INDEX IF NOT EXISTS idx_eu_est ON public.establishment_users(establishment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_users TO authenticated;
GRANT ALL ON public.establishment_users TO service_role;

ALTER TABLE public.establishment_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own membership"
ON public.establishment_users FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owners manage memberships"
ON public.establishment_users FOR ALL
TO authenticated
USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admins manage memberships"
ON public.establishment_users FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_eu_updated_at
BEFORE UPDATE ON public.establishment_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();