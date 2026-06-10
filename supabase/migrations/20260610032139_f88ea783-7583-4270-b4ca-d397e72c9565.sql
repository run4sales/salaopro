ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS manual_blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_blocked_reason text;