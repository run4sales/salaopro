-- Ensure appointment time blocks exist in deployed databases and refresh PostgREST's schema cache.
-- Some environments may have shipped the agenda UI before this support table was available.

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

ALTER TABLE public.appointment_blocks
  ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS end_time timestamptz,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.appointment_blocks
  ALTER COLUMN establishment_id SET NOT NULL,
  ALTER COLUMN professional_id SET NOT NULL,
  ALTER COLUMN start_time SET NOT NULL,
  ALTER COLUMN end_time SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointment_blocks_valid_range'
      AND conrelid = 'public.appointment_blocks'::regclass
  ) THEN
    ALTER TABLE public.appointment_blocks
      ADD CONSTRAINT appointment_blocks_valid_range CHECK (end_time > start_time);
  END IF;
END $$;

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

-- Force PostgREST to see the table immediately after this migration is applied.
SELECT pg_notify('pgrst', 'reload schema');
