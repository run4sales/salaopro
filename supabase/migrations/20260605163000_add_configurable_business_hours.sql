-- Store configurable business hours per establishment and expose them through public booking RPCs.
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
  DROP CONSTRAINT IF EXISTS settings_business_hours_order_check;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_business_hours_order_check CHECK (opening_time < closing_time);

CREATE OR REPLACE FUNCTION public.sync_legacy_business_hours()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.business_open_time := NEW.opening_time;
  NEW.business_close_time := NEW.closing_time;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_legacy_business_hours ON public.settings;
CREATE TRIGGER trg_sync_legacy_business_hours
BEFORE INSERT OR UPDATE OF opening_time, closing_time ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_legacy_business_hours();

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
    'opening_time', to_char(COALESCE(s.opening_time, '08:00'::time), 'HH24:MI'),
    'closing_time', to_char(COALESCE(s.closing_time, '19:00'::time), 'HH24:MI')
  )
  INTO result
  FROM public.profiles p
  LEFT JOIN public.settings s ON s.establishment_id = p.id
  WHERE p.slug = p_slug
  LIMIT 1;
  RETURN result;
END; $$;

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
    'opening_time', to_char(COALESCE(s.opening_time, '08:00'::time), 'HH24:MI'),
    'closing_time', to_char(COALESCE(s.closing_time, '19:00'::time), 'HH24:MI')
  )
  INTO result
  FROM public.profiles p
  LEFT JOIN public.settings s ON s.establishment_id = p.id
  WHERE p.id = p_id
  LIMIT 1;
  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_public_salon_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_salon_by_id(uuid) TO anon, authenticated;
