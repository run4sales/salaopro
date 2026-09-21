ALTER FUNCTION public.validate_contact_fields() SECURITY DEFINER;
ALTER FUNCTION public.validate_contact_fields() SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.validate_contact_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_contact_fields() TO service_role;