-- Prevent concurrent/replayed deliveries from being processed more than once.
-- Existing rows predate provider event ids and intentionally remain NULL.
ALTER TABLE public.asaas_webhook_logs
  ADD COLUMN IF NOT EXISTS provider_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS asaas_webhook_logs_provider_event_id_key
  ON public.asaas_webhook_logs(provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS asaas_webhook_logs_created_at_idx
  ON public.asaas_webhook_logs(created_at DESC);

COMMENT ON COLUMN public.asaas_webhook_logs.provider_event_id IS
  'Provider event id, or a sha256 body fingerprint when the provider omits it; used only for replay protection.';
