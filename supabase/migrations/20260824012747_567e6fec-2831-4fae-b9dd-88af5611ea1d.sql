-- 1) Coluna de auditoria: quem criou a venda (migration 20260704120000 estava pendente)
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

-- 2) Staff pode registrar vendas no PDV (hoje: SELECT apenas -> INSERT bloqueado por RLS)
DROP POLICY IF EXISTS "Staff can create establishment sales" ON public.sales;
CREATE POLICY "Staff can create establishment sales"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    public.is_establishment_member(establishment_id, auth.uid())
    AND created_by_user_id = auth.uid()
  );

-- 3) Staff pode gravar o rateio de comissões da venda que acabou de criar
DROP POLICY IF EXISTS "Staff can create sale_professionals" ON public.sale_professionals;
CREATE POLICY "Staff can create sale_professionals"
  ON public.sale_professionals FOR INSERT TO authenticated
  WITH CHECK (
    public.is_establishment_member(establishment_id, auth.uid())
  );

-- 4) Remove trigger duplicado de trial em profiles (duas triggers chamavam a mesma função)
DROP TRIGGER IF EXISTS create_subscription_on_profile_insert ON public.profiles;

NOTIFY pgrst, 'reload schema';