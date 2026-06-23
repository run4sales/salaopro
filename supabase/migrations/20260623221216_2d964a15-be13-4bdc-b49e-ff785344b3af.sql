
-- 1) Financial tables: staff SELECT-only
DROP POLICY IF EXISTS "Staff can access establishment data" ON public.sales;
CREATE POLICY "Staff can view sales"
  ON public.sales FOR SELECT TO authenticated
  USING (public.is_establishment_member(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Staff can access establishment data" ON public.sale_professionals;
CREATE POLICY "Staff can view sale_professionals"
  ON public.sale_professionals FOR SELECT TO authenticated
  USING (public.is_establishment_member(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Staff can access establishment data" ON public.comandas;
CREATE POLICY "Staff can view comandas"
  ON public.comandas FOR SELECT TO authenticated
  USING (public.is_establishment_member(establishment_id, auth.uid()));

DROP POLICY IF EXISTS "Staff can access establishment data" ON public.comanda_items;
CREATE POLICY "Staff can view comanda_items"
  ON public.comanda_items FOR SELECT TO authenticated
  USING (public.is_establishment_member(establishment_id, auth.uid()));

-- 2) Profiles: drop broad staff SELECT, expose safe RPC instead
DROP POLICY IF EXISTS "Staff can view their establishment profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_my_establishment_profile()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  est_id uuid;
  result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO est_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  IF est_id IS NULL THEN
    SELECT establishment_id INTO est_id
    FROM public.establishment_users
    WHERE user_id = auth.uid() AND active = true
    LIMIT 1;
  END IF;

  IF est_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', p.id,
    'business_name', p.business_name,
    'slug', p.slug,
    'city', p.city,
    'business_type', p.business_type,
    'accepting_bookings', p.accepting_bookings
  )
  INTO result
  FROM public.profiles p
  WHERE p.id = est_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_establishment_profile() TO authenticated;
