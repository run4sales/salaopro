-- Fix ambiguous phone column in create_public_booking function
CREATE OR REPLACE FUNCTION public.create_public_booking(
  establishment UUID,
  client_name TEXT,
  p_phone TEXT, -- Renamed from phone
  service UUID,
  professional UUID,
  start_time TIMESTAMPTZ,
  notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc RECORD;
  prof RECORD;
  existing_client RECORD;
  appt_id UUID;
  conflict_exists BOOLEAN;
BEGIN
  -- Validate service/professional belong to establishment and are active
  SELECT id, duration_minutes INTO svc FROM public.services
  WHERE id = service AND establishment_id = establishment AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço inválido';
  END IF;

  SELECT id INTO prof FROM public.professionals
  WHERE id = professional AND establishment_id = establishment AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profissional inválido';
  END IF;

  -- Basic conflict check: same professional, same start_time
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE establishment_id = establishment
      AND professional_id = professional
      AND appointment_date = start_time
      AND COALESCE(status, 'scheduled') <> 'canceled'
  ) INTO conflict_exists;

  IF conflict_exists THEN
    RAISE EXCEPTION 'Horário indisponível';
  END IF;

  -- Find or create client by phone within establishment
  SELECT id INTO existing_client FROM public.clients
  WHERE public.clients.establishment_id = establishment AND public.clients.phone = p_phone LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.clients (establishment_id, name, phone)
    VALUES (establishment, COALESCE(client_name, 'Cliente'), COALESCE(p_phone, ''))
    RETURNING id INTO existing_client;
  END IF;

  -- Create appointment
  INSERT INTO public.appointments (
    establishment_id, client_id, service_id, professional_id, appointment_date, status, notes
  ) VALUES (
    establishment, existing_client.id, service, professional, start_time, 'scheduled', notes
  ) RETURNING id INTO appt_id;

  RETURN appt_id;
END;
$$;
