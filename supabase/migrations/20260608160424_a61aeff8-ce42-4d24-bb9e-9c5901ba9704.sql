
-- 1) appointment_blocks table (clean creation; previous migration failed due to missing helper function)
CREATE TABLE IF NOT EXISTS public.appointment_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointment_blocks_valid_range'
      AND conrelid = 'public.appointment_blocks'::regclass
  ) THEN
    ALTER TABLE public.appointment_blocks
      ADD CONSTRAINT appointment_blocks_valid_range CHECK (end_time > start_time);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointment_blocks_professional_range
  ON public.appointment_blocks (establishment_id, professional_id, start_time, end_time);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_blocks TO authenticated;
GRANT ALL ON public.appointment_blocks TO service_role;

ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_blocks_establishment_access ON public.appointment_blocks;
CREATE POLICY appointment_blocks_establishment_access
  ON public.appointment_blocks
  FOR ALL
  TO authenticated
  USING (
    establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.is_establishment_member(establishment_id, auth.uid())
  )
  WITH CHECK (
    establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.is_establishment_member(establishment_id, auth.uid())
  );

DROP TRIGGER IF EXISTS update_appointment_blocks_updated_at ON public.appointment_blocks;
CREATE TRIGGER update_appointment_blocks_updated_at
  BEFORE UPDATE ON public.appointment_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Subscription info also for staff users (so blocked store blocks ALL users)
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
    'monthly_amount', s.monthly_amount
  );
END;
$function$;

-- 3) Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
