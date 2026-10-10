CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE TABLE public.asaas_audit_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
GRANT ALL ON public.asaas_audit_tickets TO service_role;
ALTER TABLE public.asaas_audit_tickets ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.consume_asaas_audit_ticket(p_ticket uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE accepted uuid;
BEGIN
  DELETE FROM public.asaas_audit_tickets WHERE id = p_ticket AND expires_at > now() RETURNING id INTO accepted;
  RETURN accepted IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_asaas_audit_ticket(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_asaas_audit_ticket(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.enqueue_asaas_audit(p_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ticket uuid;
BEGIN
  DELETE FROM public.asaas_audit_tickets WHERE expires_at < now();
  INSERT INTO public.asaas_audit_tickets DEFAULT VALUES RETURNING id INTO ticket;
  PERFORM net.http_post(url := p_url, headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('audit_ticket', ticket, 'mode', 'audit', 'limit', 100), timeout_milliseconds := 120000);
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_asaas_audit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_asaas_audit(text) TO service_role;
ALTER TABLE public.asaas_webhook_logs ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;
CREATE OR REPLACE FUNCTION public.claim_asaas_webhook(p_event_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed uuid;
BEGIN
  UPDATE public.asaas_webhook_logs SET processing_started_at = now(), error = null
  WHERE provider_event_id = p_event_id AND NOT processed
    AND (processing_started_at IS NULL OR processing_started_at < now() - interval '5 minutes')
  RETURNING id INTO claimed;
  RETURN claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_asaas_webhook(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_asaas_webhook(text) TO service_role;