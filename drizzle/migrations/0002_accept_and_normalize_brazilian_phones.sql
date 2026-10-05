CREATE OR REPLACE FUNCTION public.normalize_br_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  IF length(v_digits) IN (12,13) AND left(v_digits,2) = '55' THEN
    v_digits := substr(v_digits,3);
  END IF;
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
  IF coalesce(p_phone,'') ~ '[A-Za-z]' THEN
    RETURN 'Informe um telefone válido com DDD.';
  END IF;
  IF v_digits ~ '^([0-9])\1+$' OR v_digits LIKE '%0123456789%' OR v_digits LIKE '%1234567890%' OR v_digits LIKE '%9876543210%' OR v_digits LIKE '%0987654321%' THEN
    RETURN 'Este telefone parece inválido. Informe um número de telefone válido.';
  END IF;
  IF length(v_digits) NOT IN (10,11) THEN RETURN 'Informe um telefone válido com DDD.'; END IF;
  v_ddd := left(v_digits,2)::integer;
  v_number := substr(v_digits,3);
  IF NOT (v_ddd = ANY(v_valid_ddds))
     OR NOT ((length(v_digits)=10 AND v_number ~ '^[2-5][0-9]{7}$')
          OR (length(v_digits)=11 AND v_number ~ '^9[0-9]{8}$')) THEN
    RETURN 'Informe um telefone válido com DDD.';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.contact_phone_error(text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_br_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contact_phone_error(text,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_br_phone(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.normalize_br_phone(text) IS 'Normaliza telefone brasileiro para DDD e assinante, sem máscara nem código 55.';
COMMENT ON FUNCTION public.contact_phone_error(text,boolean) IS 'Valida telefone brasileiro após normalização, aceitando celular iniciado por 9 e telefone fixo iniciado por 2 a 5.';