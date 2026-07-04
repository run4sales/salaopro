-- Ensure sales records can audit the authenticated user that created or updated them.
-- This covers deployed databases that received client payloads with audit fields before
-- PostgREST/Supabase had refreshed the sales schema cache.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS updated_by_user_id uuid;

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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_updated_by_user_id_fkey'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_updated_by_user_id_fkey
      FOREIGN KEY (updated_by_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_created_by_user_id
  ON public.sales(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_sales_updated_by_user_id
  ON public.sales(updated_by_user_id);

COMMENT ON COLUMN public.sales.created_by_user_id IS
  'Authenticated auth.users.id that created the sale from PDV or attendance checkout.';

COMMENT ON COLUMN public.sales.updated_by_user_id IS
  'Authenticated auth.users.id that last updated the sale.';

-- Ask PostgREST to reload its schema cache after adding the audit columns.
NOTIFY pgrst, 'reload schema';
