
-- 1) Add Asaas fields to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_type text,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS billing_cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS billing_name text,
  ADD COLUMN IF NOT EXISTS billing_email text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_sub ON public.subscriptions(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_cust ON public.subscriptions(asaas_customer_id);

-- 2) Payments history
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  subscription_id uuid,
  asaas_payment_id text UNIQUE,
  asaas_subscription_id text,
  value numeric NOT NULL DEFAULT 0,
  net_value numeric,
  status text NOT NULL,
  billing_type text,
  due_date date,
  payment_date timestamptz,
  invoice_url text,
  bank_slip_url text,
  pix_qr_code text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their payments"
ON public.subscription_payments FOR SELECT TO authenticated
USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admins view all payments"
ON public.subscription_payments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_sub_payments_est ON public.subscription_payments(establishment_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_sub ON public.subscription_payments(subscription_id);

CREATE TRIGGER update_subscription_payments_updated_at
BEFORE UPDATE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Webhook logs
CREATE TABLE IF NOT EXISTS public.asaas_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text,
  asaas_payment_id text,
  asaas_subscription_id text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.asaas_webhook_logs TO service_role;

ALTER TABLE public.asaas_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view webhook logs"
ON public.asaas_webhook_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
