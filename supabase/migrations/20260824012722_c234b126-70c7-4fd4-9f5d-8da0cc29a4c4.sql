CREATE TABLE IF NOT EXISTS public.asaas_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('webhook', 'manual', 'audit')),
  establishment_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  asaas_customer_id text,
  asaas_subscription_id text,
  asaas_payment_id text,
  previous_status text,
  new_status text,
  payment_status text,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  changed boolean NOT NULL DEFAULT false,
  duration_ms integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asaas_sync_logs_establishment_created
  ON public.asaas_sync_logs(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asaas_sync_logs_failures
  ON public.asaas_sync_logs(created_at DESC) WHERE error IS NOT NULL;

GRANT ALL ON public.asaas_sync_logs TO service_role;
GRANT SELECT ON public.asaas_sync_logs TO authenticated;

ALTER TABLE public.asaas_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins view Asaas sync logs" ON public.asaas_sync_logs;
CREATE POLICY "Super admins view Asaas sync logs"
ON public.asaas_sync_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

COMMENT ON TABLE public.asaas_sync_logs IS
  'Auditoria das sincronizações de assinatura entre o sistema e o Asaas.';