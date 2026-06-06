-- Save general settings through an RPC so the client does not depend on newly-added REST column names.
CREATE OR REPLACE FUNCTION public.upsert_general_settings(
  p_establishment_id uuid,
  p_inactive_days_threshold integer,
  p_business_open_time time without time zone,
  p_business_close_time time without time zone
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF p_business_open_time >= p_business_close_time THEN
    RAISE EXCEPTION 'O horário de abertura deve ser menor que o horário de fechamento';
  END IF;

  INSERT INTO public.settings (
    establishment_id,
    inactive_days_threshold,
    business_open_time,
    business_close_time
  )
  VALUES (
    p_establishment_id,
    p_inactive_days_threshold,
    p_business_open_time,
    p_business_close_time
  )
  ON CONFLICT (establishment_id) DO UPDATE
  SET
    inactive_days_threshold = EXCLUDED.inactive_days_threshold,
    business_open_time = EXCLUDED.business_open_time,
    business_close_time = EXCLUDED.business_close_time,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_general_settings(uuid, integer, time without time zone, time without time zone) TO authenticated;

-- Ensure PostgREST sees the new RPC immediately after the migration.
SELECT pg_notify('pgrst', 'reload schema');
