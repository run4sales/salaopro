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

ALTER TABLE public.asaas_sync_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.asaas_sync_logs TO service_role;
GRANT SELECT ON public.asaas_sync_logs TO authenticated;

DROP POLICY IF EXISTS "Super admins view Asaas sync logs" ON public.asaas_sync_logs;
CREATE POLICY "Super admins view Asaas sync logs"
ON public.asaas_sync_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

COMMENT ON TABLE public.asaas_sync_logs IS
  'Auditoria das sincronizações de assinatura entre Beauty Core e Asaas.';

-- Reconciliation is independent from webhook delivery. Configure the Vault
-- secret `asaas_sync_secret` with the same value as ASAAS_SYNC_SECRET used by
-- the Edge Function. The hourly job then audits every linked subscription.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'asaas-hourly-subscription-audit') THEN
    PERFORM cron.unschedule('asaas-hourly-subscription-audit');
  END IF;
END $$;

SELECT cron.schedule(
  'asaas-hourly-subscription-audit',
  '17 * * * *',
  $job$
    SELECT net.http_post(
      url := 'https://gikjhasawuhylrpchfqv.supabase.co/functions/v1/asaas-sync-subscriptions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-asaas-sync-secret', COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'asaas_sync_secret' LIMIT 1),
          ''
        )
      ),
      body := '{"mode":"audit","limit":2000}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);
