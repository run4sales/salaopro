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
  v_distinct_characters integer;
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
  IF length(v_compact) >= 8 THEN
    SELECT count(DISTINCT character)
      INTO v_distinct_characters
      FROM regexp_split_to_table(v_compact, '') AS character;
  END IF;
  IF v_compact IN ('asdf','fake','falso','naoexiste','noemail','sememail','test','teste')
     OR v_domain IN ('asdf.com','example.com','example.org','test.com')
     OR (length(v_compact) >= 8 AND (
       v_compact ~ '^([a-z0-9])\1+$'
       OR v_compact ~ '^([a-z0-9]{2})\1{3,}$'
       OR v_distinct_characters <= 2
     )) THEN
    RETURN 'Este e-mail parece inválido ou fictício. Informe um endereço de e-mail válido.';
  END IF;
  RETURN NULL;
END;
$$;