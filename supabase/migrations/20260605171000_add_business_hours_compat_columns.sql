-- Compatibility aliases for already-deployed clients that use opening_time/closing_time.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS opening_time time without time zone,
  ADD COLUMN IF NOT EXISTS closing_time time without time zone;

UPDATE public.settings
SET
  opening_time = COALESCE(opening_time, business_open_time, '08:00'::time),
  closing_time = COALESCE(closing_time, business_close_time, '19:00'::time)
WHERE opening_time IS NULL OR closing_time IS NULL;

ALTER TABLE public.settings
  ALTER COLUMN opening_time SET NOT NULL,
  ALTER COLUMN opening_time SET DEFAULT '08:00'::time,
  ALTER COLUMN closing_time SET NOT NULL,
  ALTER COLUMN closing_time SET DEFAULT '19:00'::time;

ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_opening_closing_time_order_check;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_opening_closing_time_order_check CHECK (opening_time < closing_time);

CREATE OR REPLACE FUNCTION public.sync_settings_business_hours_aliases()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.business_open_time := COALESCE(NEW.business_open_time, NEW.opening_time, '08:00'::time);
    NEW.business_close_time := COALESCE(NEW.business_close_time, NEW.closing_time, '19:00'::time);
    NEW.opening_time := COALESCE(NEW.opening_time, NEW.business_open_time, '08:00'::time);
    NEW.closing_time := COALESCE(NEW.closing_time, NEW.business_close_time, '19:00'::time);
  ELSE
    IF NEW.opening_time IS DISTINCT FROM OLD.opening_time OR NEW.closing_time IS DISTINCT FROM OLD.closing_time THEN
      NEW.business_open_time := NEW.opening_time;
      NEW.business_close_time := NEW.closing_time;
    ELSIF NEW.business_open_time IS DISTINCT FROM OLD.business_open_time OR NEW.business_close_time IS DISTINCT FROM OLD.business_close_time THEN
      NEW.opening_time := NEW.business_open_time;
      NEW.closing_time := NEW.business_close_time;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_settings_business_hours_aliases ON public.settings;
CREATE TRIGGER trg_sync_settings_business_hours_aliases
BEFORE INSERT OR UPDATE OF opening_time, closing_time, business_open_time, business_close_time ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_settings_business_hours_aliases();
