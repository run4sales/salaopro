
-- 1. Origem do cliente
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT;

-- 2. Comissão por serviço (3 faixas)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS commission_solo NUMERIC(5,2) NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS commission_with_assistants NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_as_assistant NUMERIC(5,2) NOT NULL DEFAULT 0;

-- 3. Profissionais por venda
CREATE TABLE IF NOT EXISTS public.sale_professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'solo' CHECK (role IN ('solo','with_assistants','as_assistant')),
  commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_professionals_sale ON public.sale_professionals(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_professionals_prof ON public.sale_professionals(professional_id);
CREATE INDEX IF NOT EXISTS idx_sale_professionals_est ON public.sale_professionals(establishment_id);

ALTER TABLE public.sale_professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments can manage their sale_professionals"
  ON public.sale_professionals
  FOR ALL
  USING (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Super admins can view all sale_professionals"
  ON public.sale_professionals
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));
