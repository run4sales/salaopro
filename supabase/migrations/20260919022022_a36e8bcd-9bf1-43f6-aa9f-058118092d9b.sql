CREATE OR REPLACE FUNCTION public.create_public_booking(establishment uuid, client_name text, p_phone text, p_services uuid[], p_professionals uuid[], start_time timestamp with time zone, notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_client RECORD;
  appt_id uuid;
  accepting boolean;
  primary_service uuid;
  primary_professional uuid;
  svc uuid;
  prof uuid;
  total_duration int := 0;
  end_time timestamptz;
  open_t time := TIME '08:00';
  close_t time := TIME '19:00';
  wdays int[] := ARRAY[1,2,3,4,5,6];
  wh jsonb;
  day_cfg jsonb;
  ivs jsonb;
  iv jsonb;
  iv_open_min int;
  iv_close_min int;
  fits_iv boolean := false;
  dow int;
  start_minutes int;
  end_minutes int;
  open_minutes int;
  close_minutes int;
  block_count int;
  overlap_count int;
  phone_error text;
  normalized_phone text;
BEGIN
  phone_error := public.contact_phone_error(p_phone, true);
  IF phone_error IS NOT NULL THEN
    RAISE EXCEPTION USING MESSAGE = phone_error, ERRCODE = '22023';
  END IF;
  normalized_phone := public.normalize_br_phone(p_phone);

  SELECT accepting_bookings INTO accepting FROM public.profiles WHERE id = establishment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Salão não encontrado'; END IF;
  IF accepting IS FALSE THEN RAISE EXCEPTION 'Agendamentos temporariamente indisponíveis'; END IF;

  IF p_services IS NULL OR array_length(p_services,1) IS NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos um serviço';
  END IF;
  IF p_professionals IS NULL OR array_length(p_professionals,1) IS NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos um profissional';
  END IF;

  SELECT COALESCE(SUM(s.duration_minutes),0)
    INTO total_duration
  FROM public.services s
  WHERE s.establishment_id = establishment
    AND s.active = true
    AND s.id = ANY(p_services);

  IF total_duration = 0 THEN RAISE EXCEPTION 'Serviços inválidos'; END IF;

  end_time := start_time + make_interval(mins => total_duration);

  SELECT COALESCE(st.business_open_time, TIME '08:00'),
         COALESCE(st.business_close_time, TIME '19:00'),
         COALESCE(st.working_days, ARRAY[1,2,3,4,5,6]),
         st.weekly_hours
    INTO open_t, close_t, wdays, wh
  FROM public.settings st
  WHERE st.establishment_id = establishment;

  dow := EXTRACT(DOW FROM start_time AT TIME ZONE 'UTC')::int;
  start_minutes := EXTRACT(HOUR FROM start_time AT TIME ZONE 'UTC')::int * 60
                 + EXTRACT(MINUTE FROM start_time AT TIME ZONE 'UTC')::int;
  end_minutes   := EXTRACT(HOUR FROM end_time AT TIME ZONE 'UTC')::int * 60
                 + EXTRACT(MINUTE FROM end_time AT TIME ZONE 'UTC')::int;

  IF wh IS NOT NULL AND wh <> '{}'::jsonb THEN
    day_cfg := wh -> dow::text;
    IF day_cfg IS NULL OR COALESCE((day_cfg->>'open')::boolean, false) = false THEN
      RAISE EXCEPTION 'Loja fechada neste dia da semana';
    END IF;
    ivs := day_cfg -> 'intervals';
    IF ivs IS NULL OR jsonb_array_length(ivs) = 0 THEN
      RAISE EXCEPTION 'Loja fechada neste dia da semana';
    END IF;
    FOR iv IN SELECT * FROM jsonb_array_elements(ivs) LOOP
      iv_open_min := substring(iv->>'open' from 1 for 2)::int * 60 + substring(iv->>'open' from 4 for 2)::int;
      iv_close_min := substring(iv->>'close' from 1 for 2)::int * 60 + substring(iv->>'close' from 4 for 2)::int;
      IF start_minutes >= iv_open_min AND end_minutes <= iv_close_min THEN
        fits_iv := true;
        EXIT;
      END IF;
    END LOOP;
    IF NOT fits_iv THEN RAISE EXCEPTION 'Horário fora do funcionamento da loja'; END IF;
  ELSE
    IF NOT (dow = ANY(wdays)) THEN RAISE EXCEPTION 'Loja fechada neste dia da semana'; END IF;
    open_minutes := EXTRACT(HOUR FROM open_t)::int * 60 + EXTRACT(MINUTE FROM open_t)::int;
    close_minutes := EXTRACT(HOUR FROM close_t)::int * 60 + EXTRACT(MINUTE FROM close_t)::int;
    IF start_minutes < open_minutes OR end_minutes > close_minutes THEN
      RAISE EXCEPTION 'Horário fora do funcionamento da loja';
    END IF;
  END IF;

  primary_service := p_services[1];
  primary_professional := p_professionals[1];

  SELECT COUNT(*) INTO block_count
  FROM public.appointment_blocks b
  WHERE b.establishment_id = establishment
    AND b.professional_id = ANY(p_professionals)
    AND b.start_time < end_time
    AND b.end_time > start_time;
  IF block_count > 0 THEN RAISE EXCEPTION 'Profissional bloqueado neste horário'; END IF;

  SELECT COUNT(*) INTO overlap_count
  FROM public.appointments a
  WHERE a.establishment_id = establishment
    AND a.professional_id = ANY(p_professionals)
    AND COALESCE(a.status,'scheduled') <> 'canceled'
    AND a.appointment_date < end_time
    AND a.appointment_date + make_interval(mins => COALESCE(a.duration_minutes, 30)) > start_time;
  IF overlap_count > 0 THEN RAISE EXCEPTION 'Horário indisponível para o profissional'; END IF;

  SELECT id INTO existing_client FROM public.clients
  WHERE establishment_id = establishment AND phone = normalized_phone LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.clients (establishment_id, name, phone)
    VALUES (establishment, COALESCE(client_name,'Cliente'), normalized_phone)
    RETURNING id INTO existing_client;
  END IF;

  INSERT INTO public.appointments
    (establishment_id, client_id, service_id, professional_id, appointment_date, duration_minutes, status, notes)
  VALUES (establishment, existing_client.id, primary_service, primary_professional, start_time, total_duration, 'scheduled', notes)
  RETURNING id INTO appt_id;

  FOREACH svc IN ARRAY p_services LOOP
    INSERT INTO public.appointment_services (appointment_id, service_id, establishment_id)
    VALUES (appt_id, svc, establishment) ON CONFLICT DO NOTHING;
  END LOOP;

  FOREACH prof IN ARRAY p_professionals LOOP
    INSERT INTO public.appointment_professionals (appointment_id, professional_id, establishment_id)
    VALUES (appt_id, prof, establishment) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN appt_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.contact_email_error(text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contact_phone_error(text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_br_phone(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_contact_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contact_email_error(text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.contact_phone_error(text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.normalize_br_phone(text) TO service_role;