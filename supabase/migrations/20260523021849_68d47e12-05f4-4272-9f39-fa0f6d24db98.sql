
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS birth_day smallint,
  ADD COLUMN IF NOT EXISTS birth_month smallint,
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS imported_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_clients_estab_phone ON public.clients (establishment_id, phone);
CREATE INDEX IF NOT EXISTS idx_clients_estab_email ON public.clients (establishment_id, email);
