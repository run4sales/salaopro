-- 1) Junction table to link services and professionals
CREATE TABLE IF NOT EXISTS public.service_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  service_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, professional_id)
);

-- Enable RLS
ALTER TABLE public.service_professionals ENABLE ROW LEVEL SECURITY;

-- Policies: establishments manage their rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_professionals' AND policyname = 'Establishments can manage their service_professionals'
  ) THEN
    CREATE POLICY "Establishments can manage their service_professionals"
    ON public.service_professionals
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

-- Optional read for super admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_professionals' AND policyname = 'Super admins can view all service_professionals'
  ) THEN
    CREATE POLICY "Super admins can view all service_professionals"
    ON public.service_professionals
    FOR SELECT
    USING (has_role(auth.uid(), 'super_admin')); 
  END IF;
END $$;

-- 2) Public RPC to list professionals by service
CREATE OR REPLACE FUNCTION public.get_public_service_professionals(establishment uuid, service uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  professionals_json JSON;
BEGIN
  SELECT COALESCE(
    json_agg(json_build_object(
      'id', p.id,
      'name', p.name
    ) ORDER BY p.name), '[]'::json)
  INTO professionals_json
  FROM public.professionals p
  INNER JOIN public.service_professionals sp ON sp.professional_id = p.id
  WHERE p.establishment_id = establishment
    AND sp.service_id = service
    AND p.active = true;

  RETURN professionals_json;
END;
$$;