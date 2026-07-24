-- Control whether a service is exposed in the public booking flow.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS available_online BOOLEAN;

UPDATE public.services
SET available_online = true
WHERE available_online IS NULL;

ALTER TABLE public.services
  ALTER COLUMN available_online SET DEFAULT true,
  ALTER COLUMN available_online SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_public_catalog
  ON public.services (establishment_id, name)
  WHERE active = true AND kind = 'service' AND available_online = true;

-- Only the establishment owner or an administrator may change this setting.
CREATE OR REPLACE FUNCTION public.enforce_service_available_online_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (
    (TG_OP = 'INSERT' AND NEW.available_online = false)
    OR (TG_OP = 'UPDATE' AND NEW.available_online IS DISTINCT FROM OLD.available_online)
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.establishment_id
      AND p.user_id = auth.uid()

    UNION ALL

    SELECT 1
    FROM public.establishment_users eu
    WHERE eu.establishment_id = NEW.establishment_id
      AND eu.user_id = auth.uid()
      AND eu.active = true
      AND eu.role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar a disponibilidade online de um serviço';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_service_available_online_admin ON public.services;
CREATE TRIGGER enforce_service_available_online_admin
BEFORE INSERT OR UPDATE OF available_online ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.enforce_service_available_online_admin();

-- The public catalog is the only public read path for services. It never exposes hidden services.
DROP FUNCTION IF EXISTS public.get_public_catalog(UUID);
CREATE FUNCTION public.get_public_catalog(establishment UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'services',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'price', s.price,
            'duration', s.duration_minutes
          )
          ORDER BY s.name
        )
        FROM public.services s
        WHERE s.establishment_id = establishment
          AND s.kind = 'service'
          AND s.active = true
          AND s.available_online = true
      ), '[]'::jsonb),
    'professionals',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', p.id, 'name', p.name)
          ORDER BY p.name
        )
        FROM public.professionals p
        WHERE p.establishment_id = establishment
          AND p.active = true
      ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_catalog(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_catalog(UUID) TO anon, authenticated;

-- A direct anonymous RPC call cannot use an ID for a service hidden from online booking.
CREATE OR REPLACE FUNCTION public.reject_hidden_service_from_public_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL AND EXISTS (
    SELECT 1
    FROM public.services s
    WHERE s.id = NEW.service_id
      AND s.available_online = false
  ) THEN
    RAISE EXCEPTION 'Este serviço não está disponível para agendamento online';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_hidden_service_from_public_booking ON public.appointment_services;
CREATE TRIGGER reject_hidden_service_from_public_booking
BEFORE INSERT OR UPDATE OF service_id ON public.appointment_services
FOR EACH ROW
EXECUTE FUNCTION public.reject_hidden_service_from_public_booking();

-- Public users must use the filtered RPC instead of reading the services table directly.
REVOKE SELECT ON TABLE public.services FROM anon;

NOTIFY pgrst, 'reload schema';
