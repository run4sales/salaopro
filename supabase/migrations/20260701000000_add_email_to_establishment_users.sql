ALTER TABLE public.establishment_users
ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS establishment_users_establishment_email_idx
ON public.establishment_users (establishment_id, lower(email))
WHERE email IS NOT NULL;
