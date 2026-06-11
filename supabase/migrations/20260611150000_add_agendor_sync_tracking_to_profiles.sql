ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agendor_organization_id bigint,
  ADD COLUMN IF NOT EXISTS agendor_deal_id bigint,
  ADD COLUMN IF NOT EXISTS agendor_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS agendor_sync_error text;

CREATE INDEX IF NOT EXISTS profiles_agendor_deal_id_idx
  ON public.profiles (agendor_deal_id)
  WHERE agendor_deal_id IS NOT NULL;
