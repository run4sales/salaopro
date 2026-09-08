ALTER TABLE public.appointment_services
  ADD COLUMN IF NOT EXISTS unit_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_source text NOT NULL DEFAULT 'service';

ALTER TABLE public.appointment_services
  DROP CONSTRAINT IF EXISTS appointment_services_price_source_check;

ALTER TABLE public.appointment_services
  ADD CONSTRAINT appointment_services_price_source_check
  CHECK (price_source IN ('service','negotiated'));

UPDATE public.appointment_services aps
SET unit_price = s.price
FROM public.services s
WHERE s.id = aps.service_id AND aps.unit_price = 0;