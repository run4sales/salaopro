
-- Join tables for multi-service / multi-professional appointments
CREATE TABLE public.appointment_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL,
  service_id uuid NOT NULL,
  establishment_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, service_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_services TO authenticated;
GRANT ALL ON public.appointment_services TO service_role;
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments manage appointment_services"
ON public.appointment_services FOR ALL
USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Staff access appointment_services"
ON public.appointment_services FOR ALL TO authenticated
USING (public.is_establishment_member(establishment_id, auth.uid()))
WITH CHECK (public.is_establishment_member(establishment_id, auth.uid()));

CREATE POLICY "Super admins view appointment_services"
ON public.appointment_services FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_appointment_services_appt ON public.appointment_services(appointment_id);

CREATE TABLE public.appointment_professionals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  establishment_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, professional_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_professionals TO authenticated;
GRANT ALL ON public.appointment_professionals TO service_role;
ALTER TABLE public.appointment_professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments manage appointment_professionals"
ON public.appointment_professionals FOR ALL
USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Staff access appointment_professionals"
ON public.appointment_professionals FOR ALL TO authenticated
USING (public.is_establishment_member(establishment_id, auth.uid()))
WITH CHECK (public.is_establishment_member(establishment_id, auth.uid()));

CREATE POLICY "Super admins view appointment_professionals"
ON public.appointment_professionals FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_appointment_professionals_appt ON public.appointment_professionals(appointment_id);

-- Backfill from existing single columns
INSERT INTO public.appointment_services (appointment_id, service_id, establishment_id)
SELECT id, service_id, establishment_id FROM public.appointments
WHERE service_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.appointment_professionals (appointment_id, professional_id, establishment_id)
SELECT id, professional_id, establishment_id FROM public.appointments
WHERE professional_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Replace public booking RPC to accept arrays
DROP FUNCTION IF EXISTS public.create_public_booking(uuid, text, text, uuid, uuid, timestamptz, text);

CREATE OR REPLACE FUNCTION public.create_public_booking(
  establishment uuid,
  client_name text,
  p_phone text,
  services uuid[],
  professionals uuid[],
  start_time timestamptz,
  notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  existing_client RECORD;
  appt_id uuid;
  accepting boolean;
  primary_service uuid;
  primary_professional uuid;
  svc uuid;
  prof uuid;
  total_duration int := 0;
BEGIN
  SELECT accepting_bookings INTO accepting FROM public.profiles WHERE id = establishment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Salão não encontrado'; END IF;
  IF accepting IS FALSE THEN RAISE EXCEPTION 'Agendamentos temporariamente indisponíveis'; END IF;
  IF services IS NULL OR array_length(services,1) IS NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos um serviço';
  END IF;
  IF professionals IS NULL OR array_length(professionals,1) IS NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos um profissional';
  END IF;

  -- validate services and sum durations
  SELECT COALESCE(SUM(duration_minutes),0) INTO total_duration
  FROM public.services
  WHERE establishment_id = establishment AND active = true AND id = ANY(services);

  IF total_duration = 0 THEN RAISE EXCEPTION 'Serviços inválidos'; END IF;

  primary_service := services[1];
  primary_professional := professionals[1];

  -- find or create client
  SELECT id INTO existing_client FROM public.clients
  WHERE establishment_id = establishment AND phone = p_phone LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.clients (establishment_id, name, phone)
    VALUES (establishment, COALESCE(client_name,'Cliente'), COALESCE(p_phone,''))
    RETURNING id INTO existing_client;
  END IF;

  INSERT INTO public.appointments (establishment_id, client_id, service_id, professional_id, appointment_date, status, notes)
  VALUES (establishment, existing_client.id, primary_service, primary_professional, start_time, 'scheduled', notes)
  RETURNING id INTO appt_id;

  FOREACH svc IN ARRAY services LOOP
    INSERT INTO public.appointment_services (appointment_id, service_id, establishment_id)
    VALUES (appt_id, svc, establishment) ON CONFLICT DO NOTHING;
  END LOOP;

  FOREACH prof IN ARRAY professionals LOOP
    INSERT INTO public.appointment_professionals (appointment_id, professional_id, establishment_id)
    VALUES (appt_id, prof, establishment) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN appt_id;
END; $$;
