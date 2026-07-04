-- Ensure sales records carry the authenticated user who launched the sale.
-- This migration is intentionally idempotent because older environments may have
-- code already sending created_by_user_id before the database/schema cache has
-- the column available.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_created_by_user_id_fkey'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_created_by_user_id_fkey
      FOREIGN KEY (created_by_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_created_by_user_id
  ON public.sales(created_by_user_id);

COMMENT ON COLUMN public.sales.created_by_user_id IS
  'Authenticated user that created/launched the sale, including PDV and attendance checkout flows.';

-- Ask PostgREST/Supabase API to refresh its schema cache after the column is added.
NOTIFY pgrst, 'reload schema';
