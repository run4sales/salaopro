
-- Comandas (open orders) and comanda_items
CREATE TABLE public.comandas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL,
  appointment_id UUID,
  client_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comandas_estab_status ON public.comandas(establishment_id, status);
CREATE INDEX idx_comandas_appointment ON public.comandas(appointment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comandas TO authenticated;
GRANT ALL ON public.comandas TO service_role;

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments manage their comandas"
ON public.comandas FOR ALL TO authenticated
USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admins view all comandas"
ON public.comandas FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_comandas_updated_at
BEFORE UPDATE ON public.comandas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.comanda_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL,
  comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'service',
  service_id UUID,
  name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  professional_id UUID,
  commission_percentage NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comanda_items_comanda ON public.comanda_items(comanda_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comanda_items TO authenticated;
GRANT ALL ON public.comanda_items TO service_role;

ALTER TABLE public.comanda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments manage their comanda_items"
ON public.comanda_items FOR ALL TO authenticated
USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admins view all comanda_items"
ON public.comanda_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_comanda_items_updated_at
BEFORE UPDATE ON public.comanda_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.comandas REPLICA IDENTITY FULL;
ALTER TABLE public.comanda_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comanda_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
