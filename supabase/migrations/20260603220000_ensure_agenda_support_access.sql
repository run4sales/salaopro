-- Ensure agenda support resources exist and can be read by establishment members.
-- This keeps the agenda page from failing when optional support data is queried.

CREATE TABLE IF NOT EXISTS public.appointment_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_blocks_valid_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_appointment_blocks_professional_range
  ON public.appointment_blocks (establishment_id, professional_id, start_time, end_time);

ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_blocks TO authenticated;
GRANT ALL ON public.appointment_blocks TO service_role;

DROP POLICY IF EXISTS appointment_blocks_establishment_access ON public.appointment_blocks;
CREATE POLICY appointment_blocks_establishment_access
  ON public.appointment_blocks
  FOR ALL
  TO authenticated
  USING (
    establishment_id = public.current_establishment_id()
    OR public.is_establishment_member(establishment_id, auth.uid())
    OR establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    establishment_id = public.current_establishment_id()
    OR public.is_establishment_member(establishment_id, auth.uid())
    OR establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS update_appointment_blocks_updated_at ON public.appointment_blocks;
CREATE TRIGGER update_appointment_blocks_updated_at
  BEFORE UPDATE ON public.appointment_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
