CREATE OR REPLACE FUNCTION public.get_my_employee_context()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'establishment_id', eu.establishment_id,
    'professional_id', eu.professional_id,
    'role', eu.role,
    'professional_name', p.name,
    'professional_active', COALESCE(p.active, false),
    'business_name', pr.business_name,
    'slug', pr.slug,
    'accepting_bookings', pr.accepting_bookings
  )
  INTO result
  FROM public.establishment_users eu
  LEFT JOIN public.professionals p
    ON p.id = eu.professional_id
   AND p.establishment_id = eu.establishment_id
  LEFT JOIN public.profiles pr
    ON pr.id = eu.establishment_id
  WHERE eu.user_id = auth.uid()
    AND eu.active = true
  ORDER BY CASE WHEN eu.role = 'employee' THEN 0 ELSE 1 END, eu.created_at DESC
  LIMIT 1;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_employee_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_employee_context() TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_employee_agenda(_start timestamptz, _end timestamptz)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ctx RECORD;
  appointments_json json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT eu.establishment_id, eu.professional_id, eu.role, p.name AS professional_name
    INTO ctx
  FROM public.establishment_users eu
  LEFT JOIN public.professionals p
    ON p.id = eu.professional_id
   AND p.establishment_id = eu.establishment_id
  WHERE eu.user_id = auth.uid()
    AND eu.active = true
  ORDER BY CASE WHEN eu.role = 'employee' THEN 0 ELSE 1 END, eu.created_at DESC
  LIMIT 1;

  IF ctx.establishment_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário sem vínculo ativo com uma loja';
  END IF;

  IF ctx.professional_id IS NULL THEN
    RETURN json_build_object(
      'establishment_id', ctx.establishment_id,
      'professional_id', NULL,
      'professional_name', NULL,
      'appointments', '[]'::json
    );
  END IF;

  WITH visible_appointments AS (
    SELECT DISTINCT a.id, a.establishment_id, a.appointment_date, a.duration_minutes,
           a.service_amount, a.status, a.notes, a.client_id, a.service_id, a.professional_id
    FROM public.appointments a
    LEFT JOIN public.appointment_professionals ap
      ON ap.appointment_id = a.id
     AND ap.professional_id = ctx.professional_id
     AND ap.establishment_id = ctx.establishment_id
    WHERE a.establishment_id = ctx.establishment_id
      AND a.appointment_date >= _start
      AND a.appointment_date <= _end
      AND COALESCE(a.status, 'scheduled') NOT IN ('canceled', 'cancelled')
      AND (a.professional_id = ctx.professional_id OR ap.professional_id IS NOT NULL)
  )
  SELECT COALESCE(json_agg(json_build_object(
    'id', va.id,
    'establishment_id', va.establishment_id,
    'appointment_date', va.appointment_date,
    'duration_minutes', va.duration_minutes,
    'service_amount', va.service_amount,
    'status', va.status,
    'notes', va.notes,
    'client_id', va.client_id,
    'client_name', COALESCE(c.name, 'Cliente'),
    'service_id', va.service_id,
    'service_name', COALESCE(s.name, 'Serviço'),
    'professional_id', COALESCE(va.professional_id, ctx.professional_id),
    'professional_name', COALESCE(ctx.professional_name, p.name, 'Profissional')
  ) ORDER BY va.appointment_date), '[]'::json)
  INTO appointments_json
  FROM visible_appointments va
  LEFT JOIN public.clients c
    ON c.id = va.client_id
   AND c.establishment_id = va.establishment_id
  LEFT JOIN public.services s
    ON s.id = va.service_id
   AND s.establishment_id = va.establishment_id
  LEFT JOIN public.professionals p
    ON p.id = COALESCE(va.professional_id, ctx.professional_id)
   AND p.establishment_id = va.establishment_id;

  RETURN json_build_object(
    'establishment_id', ctx.establishment_id,
    'professional_id', ctx.professional_id,
    'professional_name', COALESCE(ctx.professional_name, 'Profissional'),
    'appointments', appointments_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_employee_agenda(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_employee_agenda(timestamptz, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_employee_attendances()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ctx RECORD;
  attendances_json json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT eu.establishment_id, eu.professional_id, eu.role, p.name AS professional_name
    INTO ctx
  FROM public.establishment_users eu
  LEFT JOIN public.professionals p
    ON p.id = eu.professional_id
   AND p.establishment_id = eu.establishment_id
  WHERE eu.user_id = auth.uid()
    AND eu.active = true
  ORDER BY CASE WHEN eu.role = 'employee' THEN 0 ELSE 1 END, eu.created_at DESC
  LIMIT 1;

  IF ctx.establishment_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário sem vínculo ativo com uma loja';
  END IF;

  IF ctx.professional_id IS NULL THEN
    RETURN json_build_object(
      'establishment_id', ctx.establishment_id,
      'professional_id', NULL,
      'professional_name', NULL,
      'attendances', '[]'::json
    );
  END IF;

  WITH visible_comandas AS (
    SELECT DISTINCT co.*,
           a.professional_id AS appointment_professional_id,
           a.appointment_date
    FROM public.comandas co
    LEFT JOIN public.appointments a
      ON a.id = co.appointment_id
     AND a.establishment_id = co.establishment_id
    LEFT JOIN public.appointment_professionals ap
      ON ap.appointment_id = a.id
     AND ap.professional_id = ctx.professional_id
     AND ap.establishment_id = ctx.establishment_id
    WHERE co.establishment_id = ctx.establishment_id
      AND co.status IN ('open', 'awaiting_payment')
      AND (
        co.id IN (
          SELECT ci.comanda_id
          FROM public.comanda_items ci
          WHERE ci.establishment_id = ctx.establishment_id
            AND ci.professional_id = ctx.professional_id
        )
        OR a.professional_id = ctx.professional_id
        OR ap.professional_id IS NOT NULL
      )
  )
  SELECT COALESCE(json_agg(json_build_object(
    'id', vc.id,
    'establishment_id', vc.establishment_id,
    'appointment_id', vc.appointment_id,
    'client_id', vc.client_id,
    'client_name', COALESCE(c.name, 'Cliente'),
    'status', vc.status,
    'subtotal', vc.subtotal,
    'discount', vc.discount,
    'total', vc.total,
    'opened_at', vc.opened_at,
    'appointment_date', vc.appointment_date,
    'professional_id', ctx.professional_id,
    'professional_name', COALESCE(ctx.professional_name, 'Profissional')
  ) ORDER BY vc.opened_at), '[]'::json)
  INTO attendances_json
  FROM visible_comandas vc
  LEFT JOIN public.clients c
    ON c.id = vc.client_id
   AND c.establishment_id = vc.establishment_id;

  RETURN json_build_object(
    'establishment_id', ctx.establishment_id,
    'professional_id', ctx.professional_id,
    'professional_name', COALESCE(ctx.professional_name, 'Profissional'),
    'attendances', attendances_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_employee_attendances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_employee_attendances() TO service_role;