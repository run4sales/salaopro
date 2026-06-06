-- Consolidated business-hours migration to avoid filename conflicts with earlier PR attempts.
-- Uses existing business_open_time/business_close_time as canonical columns and keeps
-- opening_time/closing_time as compatibility aliases for clients that already shipped.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS business_open_time time without time zone NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS business_close_time time without time zone NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS opening_time time without time zone,
  ADD COLUMN IF NOT EXISTS closing_time time without time zone;

UPDATE public.settings
SET
  business_open_time = COALESCE(business_open_time, opening_time, '08:00'::time),
  business_close_time = COALESCE(business_close_time, closing_time, '19:00'::time),
  opening_time = COALESCE(opening_time, business_open_time, '08:00'::time),
  closing_time = COALESCE(closing_time, business_close_time, '19:00'::time)
WHERE
  business_open_time IS NULL
  OR business_close_time IS NULL
  OR opening_time IS NULL
  OR closing_time IS NULL;

ALTER TABLE public.settings
  ALTER COLUMN opening_time SET NOT NULL,
  ALTER COLUMN opening_time SET DEFAULT '08:00'::time,
  ALTER COLUMN closing_time SET NOT NULL,
  ALTER COLUMN closing_time SET DEFAULT '19:00'::time;

ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_business_hours_order_check,
  DROP CONSTRAINT IF EXISTS settings_opening_closing_time_order_check;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_business_hours_order_check CHECK (business_open_time < business_close_time),
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

CREATE OR REPLACE FUNCTION public.get_public_salon_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'business_name', p.business_name,
    'city', p.city,
    'accepting_bookings', p.accepting_bookings,
    'opening_time', to_char(COALESCE(s.business_open_time, '08:00'::time), 'HH24:MI'),
    'closing_time', to_char(COALESCE(s.business_close_time, '19:00'::time), 'HH24:MI')
  )
  INTO result
  FROM public.profiles p
  LEFT JOIN public.settings s ON s.establishment_id = p.id
  WHERE p.slug = p_slug
  LIMIT 1;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_salon_by_id(p_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'business_name', p.business_name,
    'city', p.city,
    'accepting_bookings', p.accepting_bookings,
    'opening_time', to_char(COALESCE(s.business_open_time, '08:00'::time), 'HH24:MI'),
    'closing_time', to_char(COALESCE(s.business_close_time, '19:00'::time), 'HH24:MI')
  )
  INTO result
  FROM public.profiles p
  LEFT JOIN public.settings s ON s.establishment_id = p.id
  WHERE p.id = p_id
  LIMIT 1;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_salon_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_salon_by_id(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.upsert_general_settings(
  p_establishment_id uuid,
  p_inactive_days_threshold integer,
  p_business_open_time time without time zone,
  p_business_close_time time without time zone
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF p_business_open_time >= p_business_close_time THEN
    RAISE EXCEPTION 'O horário de abertura deve ser menor que o horário de fechamento';
  END IF;

  INSERT INTO public.settings (
    establishment_id,
    inactive_days_threshold,
    business_open_time,
    business_close_time
  )
  VALUES (
    p_establishment_id,
    p_inactive_days_threshold,
    p_business_open_time,
    p_business_close_time
  )
  ON CONFLICT (establishment_id) DO UPDATE
  SET
    inactive_days_threshold = EXCLUDED.inactive_days_threshold,
    business_open_time = EXCLUDED.business_open_time,
    business_close_time = EXCLUDED.business_close_time,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_general_settings(uuid, integer, time without time zone, time without time zone) TO authenticated;

-- Force PostgREST to refresh columns and RPC signatures immediately.
SELECT pg_notify('pgrst', 'reload schema');
