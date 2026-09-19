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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT eu.establishment_id, eu.professional_id, eu.role,
         p.name AS professional_name, p.calendar_color AS professional_color
    INTO ctx
  FROM public.establishment_users eu
  LEFT JOIN public.professionals p
    ON p.id = eu.professional_id
   AND p.establishment_id = eu.establishment_id
  WHERE eu.user_id = auth.uid()
    AND eu.active = true
  ORDER BY CASE WHEN eu.role = 'employee' THEN 0 ELSE 1 END, eu.created_at DESC
  LIMIT 1;

  IF ctx.establishment_id IS NULL THEN RAISE EXCEPTION 'Funcionário sem vínculo ativo com uma loja'; END IF;

  IF ctx.professional_id IS NULL THEN
    RETURN json_build_object(
      'establishment_id', ctx.establishment_id,
      'professional_id', NULL,
      'professional_name', NULL,
      'professional_color', NULL,
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
    'professional_name', COALESCE(p.name, ctx.professional_name, 'Profissional'),
    'professional_color', COALESCE(p.calendar_color, ctx.professional_color, '#2563EB')
  ) ORDER BY va.appointment_date), '[]'::json)
  INTO appointments_json
  FROM visible_appointments va
  LEFT JOIN public.clients c
    ON c.id = va.client_id AND c.establishment_id = va.establishment_id
  LEFT JOIN public.services s
    ON s.id = va.service_id AND s.establishment_id = va.establishment_id
  LEFT JOIN public.professionals p
    ON p.id = COALESCE(va.professional_id, ctx.professional_id)
   AND p.establishment_id = va.establishment_id;

  RETURN json_build_object(
    'establishment_id', ctx.establishment_id,
    'professional_id', ctx.professional_id,
    'professional_name', COALESCE(ctx.professional_name, 'Profissional'),
    'professional_color', COALESCE(ctx.professional_color, '#2563EB'),
    'appointments', appointments_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_employee_agenda(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_employee_agenda(timestamptz, timestamptz) TO authenticated, service_role;