
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accepting_bookings boolean NOT NULL DEFAULT true;

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
    'id', id,
    'business_name', business_name,
    'city', city,
    'accepting_bookings', accepting_bookings
  )
  INTO result
  FROM public.profiles
  WHERE slug = p_slug
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
    'id', id,
    'business_name', business_name,
    'city', city,
    'accepting_bookings', accepting_bookings
  )
  INTO result
  FROM public.profiles
  WHERE id = p_id
  LIMIT 1;
  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_public_salon_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_salon_by_id(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_public_booking(establishment uuid, client_name text, p_phone text, service uuid, professional uuid, start_time timestamp with time zone, notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE svc RECORD; prof RECORD; existing_client RECORD; appt_id UUID; conflict_exists BOOLEAN; accepting BOOLEAN;
BEGIN
  SELECT accepting_bookings INTO accepting FROM public.profiles WHERE id = establishment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Salão não encontrado'; END IF;
  IF accepting IS FALSE THEN RAISE EXCEPTION 'Agendamentos temporariamente indisponíveis'; END IF;

  SELECT id, duration_minutes INTO svc FROM public.services WHERE id = service AND establishment_id = establishment AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço inválido'; END IF;
  SELECT id INTO prof FROM public.professionals WHERE id = professional AND establishment_id = establishment AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profissional inválido'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.appointments WHERE establishment_id = establishment AND professional_id = professional AND appointment_date = start_time AND COALESCE(status, 'scheduled') <> 'canceled') INTO conflict_exists;
  IF conflict_exists THEN RAISE EXCEPTION 'Horário indisponível'; END IF;
  SELECT id INTO existing_client FROM public.clients WHERE public.clients.establishment_id = establishment AND public.clients.phone = p_phone LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.clients (establishment_id, name, phone) VALUES (establishment, COALESCE(client_name, 'Cliente'), COALESCE(p_phone, '')) RETURNING id INTO existing_client;
  END IF;
  INSERT INTO public.appointments (establishment_id, client_id, service_id, professional_id, appointment_date, status, notes)
  VALUES (establishment, existing_client.id, service, professional, start_time, 'scheduled', notes) RETURNING id INTO appt_id;
  RETURN appt_id;
END; $function$;
