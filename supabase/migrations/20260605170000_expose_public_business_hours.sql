-- Expose existing per-establishment business hours through public salon RPCs.
ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_business_hours_order_check;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_business_hours_order_check CHECK (business_open_time < business_close_time);

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
    'opening_time', to_char(COALESCE(s.business_open_time, '08:00'::time), 'HH24:MI'),
    'closing_time', to_char(COALESCE(s.business_close_time, '19:00'::time), 'HH24:MI')
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
