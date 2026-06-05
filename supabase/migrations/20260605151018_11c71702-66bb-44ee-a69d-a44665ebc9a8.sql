
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS service_amount numeric(10,2);

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS business_open_time time without time zone NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS business_close_time time without time zone NOT NULL DEFAULT '19:00';
