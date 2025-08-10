-- Professionals table
CREATE TABLE IF NOT EXISTS public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and policies for professionals
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'professionals' AND policyname = 'Establishments can manage their professionals'
  ) THEN
    CREATE POLICY "Establishments can manage their professionals"
    ON public.professionals
    FOR ALL
    USING (
      establishment_id IN (
        SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()
      )
    )
    WITH CHECK (
      establishment_id IN (
        SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'professionals' AND policyname = 'Super admins can view all professionals'
  ) THEN
    CREATE POLICY "Super admins can view all professionals"
    ON public.professionals
    FOR SELECT
    USING (has_role(auth.uid(), 'super_admin'::app_role));
  END IF;
END $$;

-- Trigger to maintain updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_professionals_updated_at'
  ) THEN
    CREATE TRIGGER update_professionals_updated_at
    BEFORE UPDATE ON public.professionals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_professionals_establishment ON public.professionals (establishment_id);

-- Add professional_id to appointments (nullable for backward compatibility)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'professional_id'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN professional_id UUID;
  END IF;
END $$;

-- Index for faster conflict/lookup
CREATE INDEX IF NOT EXISTS idx_appointments_est_prof_date 
ON public.appointments (establishment_id, professional_id, appointment_date);

-- Public RPC: get catalog (services + professionals) for an establishment
CREATE OR REPLACE FUNCTION public.get_public_catalog(establishment UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  services_json JSON;
  professionals_json JSON;
BEGIN
  SELECT COALESCE(
    json_agg(json_build_object(
      'id', id,
      'name', name,
      'price', price,
      'duration', duration_minutes
    ) ORDER BY name), '[]'::json)
  INTO services_json
  FROM public.services
  WHERE establishment_id = establishment AND active = true;

  SELECT COALESCE(
    json_agg(json_build_object(
      'id', id,
      'name', name
    ) ORDER BY name), '[]'::json)
  INTO professionals_json
  FROM public.professionals
  WHERE establishment_id = establishment AND active = true;

  RETURN json_build_object('services', services_json, 'professionals', professionals_json);
END;
$$;

-- Public RPC: get availability (booked times) for a day
CREATE OR REPLACE FUNCTION public.get_public_availability(
  establishment UUID,
  professional UUID,
  day DATE
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  times JSON;
BEGIN
  SELECT COALESCE(json_agg(appointment_date ORDER BY appointment_date), '[]'::json)
  INTO times
  FROM public.appointments
  WHERE establishment_id = establishment
    AND professional_id = professional
    AND appointment_date >= (day::timestamptz)
    AND appointment_date < ((day + 1)::timestamptz)
    AND COALESCE(status, 'scheduled') <> 'canceled';

  RETURN json_build_object('booked', times);
END;
$$;

-- Public RPC: create a booking
CREATE OR REPLACE FUNCTION public.create_public_booking(
  establishment UUID,
  client_name TEXT,
  phone TEXT,
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
  WHERE establishment_id = establishment AND phone = phone LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.clients (establishment_id, name, phone)
    VALUES (establishment, COALESCE(client_name, 'Cliente'), COALESCE(phone, ''))
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