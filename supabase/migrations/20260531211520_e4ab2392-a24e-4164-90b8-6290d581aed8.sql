
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'service';

ALTER TABLE public.services
  ALTER COLUMN duration_minutes SET DEFAULT 0,
  ALTER COLUMN duration_minutes DROP NOT NULL;
