CREATE OR REPLACE FUNCTION public.contact_email_error(p_email text, p_required boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_local text;
  v_domain text;
  v_compact text;
BEGIN
  IF v_email = '' THEN
    IF p_required THEN RETURN 'Informe um e-mail válido. Verifique se o endereço foi digitado corretamente.'; END IF;
    RETURN NULL;
  END IF;
  IF p_email ~ '\s' OR length(v_email) > 254 OR v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' THEN
    RETURN 'Informe um e-mail válido. Verifique se o endereço foi digitado corretamente.';
  END IF;
  v_local := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);
  v_compact := regexp_replace(v_local, '[._+\-]', '', 'g');
  IF length(v_local) > 64 OR v_local LIKE '.%' OR v_local LIKE '%.' OR v_local LIKE '%..%' THEN
    RETURN 'Informe um e-mail válido. Verifique se o endereço foi digitado corretamente.';
  END IF;
  IF v_compact IN ('asdf','fake','falso','naoexiste','noemail','sememail','test','teste')
     OR v_domain IN ('asdf.com','example.com','example.org','test.com')
     OR (length(v_compact) >= 8 AND (
       v_compact ~ '^([a-z0-9])\1+$'
       OR v_compact ~ '^([a-z0-9]{2})\1{3,}$'
       OR length(regexp_replace(v_compact, '(.)(?=.*\1)', '', 'g')) <= 2
     )) THEN
    RETURN 'Este e-mail parece inválido ou fictício. Informe um endereço de e-mail válido.';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_br_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  IF length(v_digits) IN (12,13) AND left(v_digits,2)='55' THEN v_digits := substr(v_digits,3); END IF;
  RETURN v_digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.contact_phone_error(p_phone text, p_required boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_digits text := public.normalize_br_phone(p_phone);
  v_ddd integer;
  v_number text;
  v_valid_ddds integer[] := ARRAY[11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];
BEGIN
  IF v_digits = '' THEN
    IF p_required THEN RETURN 'Informe um telefone válido com DDD.'; END IF;
    RETURN NULL;
  END IF;
  IF coalesce(p_phone,'') ~ '[A-Za-z]' OR coalesce(p_phone,'') !~ '^[0-9[:space:]()+.\-]+$' THEN
    RETURN 'Informe um telefone válido com DDD.';
  END IF;
  IF v_digits ~ '^([0-9])\1+$' OR v_digits LIKE '%0123456789%' OR v_digits LIKE '%1234567890%' OR v_digits LIKE '%9876543210%' OR v_digits LIKE '%0987654321%' THEN
    RETURN 'Este telefone parece inválido. Informe um número de telefone válido.';
  END IF;
  IF length(v_digits) NOT IN (10,11) THEN RETURN 'Informe um telefone válido com DDD.'; END IF;
  v_ddd := left(v_digits,2)::integer;
  v_number := substr(v_digits,3);
  IF NOT (v_ddd = ANY(v_valid_ddds)) OR NOT ((length(v_digits)=10 AND v_number ~ '^[2-5][0-9]{7}$') OR (length(v_digits)=11 AND v_number ~ '^9[6-9][0-9]{7}$')) THEN
    RETURN 'Informe um telefone válido com DDD.';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_contact_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_error text;
BEGIN
  IF TG_TABLE_NAME = 'clients' THEN
    IF TG_OP='INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
      v_error := public.contact_phone_error(NEW.phone, true);
      IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
      NEW.phone := public.normalize_br_phone(NEW.phone);
    END IF;
    IF TG_OP='INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
      v_error := public.contact_email_error(NEW.email, false);
      IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
      NEW.email := nullif(lower(btrim(NEW.email)), '');
    END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    IF TG_OP='INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
      v_error := public.contact_phone_error(NEW.phone, true);
      IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
      NEW.phone := public.normalize_br_phone(NEW.phone);
    END IF;
    IF TG_OP='INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
      v_error := public.contact_email_error(NEW.email, true);
      IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
      NEW.email := lower(btrim(NEW.email));
    END IF;
  ELSIF TG_TABLE_NAME = 'establishment_users' THEN
    IF TG_OP='INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
      v_error := public.contact_email_error(NEW.email, true);
      IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
      NEW.email := lower(btrim(NEW.email));
    END IF;
  ELSIF TG_TABLE_NAME = 'subscriptions' THEN
    IF TG_OP='INSERT' OR NEW.billing_email IS DISTINCT FROM OLD.billing_email THEN
      v_error := public.contact_email_error(NEW.billing_email, false);
      IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
      NEW.billing_email := nullif(lower(btrim(NEW.billing_email)), '');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_clients_contacts ON public.clients;
CREATE TRIGGER validate_clients_contacts BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.validate_contact_fields();
DROP TRIGGER IF EXISTS validate_profiles_contacts ON public.profiles;
CREATE TRIGGER validate_profiles_contacts BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_contact_fields();
DROP TRIGGER IF EXISTS validate_establishment_users_contacts ON public.establishment_users;
CREATE TRIGGER validate_establishment_users_contacts BEFORE INSERT OR UPDATE ON public.establishment_users FOR EACH ROW EXECUTE FUNCTION public.validate_contact_fields();
DROP TRIGGER IF EXISTS validate_subscriptions_contacts ON public.subscriptions;
CREATE TRIGGER validate_subscriptions_contacts BEFORE INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.validate_contact_fields();

REVOKE ALL ON FUNCTION public.contact_email_error(text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contact_phone_error(text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_br_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contact_email_error(text,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contact_phone_error(text,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_br_phone(text) TO authenticated, service_role;