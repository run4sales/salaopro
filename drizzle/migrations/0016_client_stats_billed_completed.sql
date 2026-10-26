CREATE OR REPLACE FUNCTION public.recalculate_client_stats(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_client_id IS NULL THEN RETURN; END IF;
  WITH appts AS (
    SELECT a.appointment_date,
           (SELECT max(s.sale_date) FROM public.sales s WHERE s.appointment_id = a.id AND s.deleted_at IS NULL) AS billed_at
      FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id AND c.establishment_id = a.establishment_id
     WHERE a.client_id = p_client_id AND lower(coalesce(a.status,'')) = 'completed'
  ), visits AS (
    SELECT CASE WHEN appointment_date <= now() THEN appointment_date ELSE billed_at END AS visited_at
      FROM appts WHERE appointment_date <= now() OR billed_at IS NOT NULL
    UNION ALL
    SELECT max(s.sale_date)
      FROM public.sales s
      JOIN public.clients c ON c.id = s.client_id AND c.establishment_id = s.establishment_id
     WHERE s.client_id = p_client_id AND s.deleted_at IS NULL AND s.appointment_id IS NULL AND s.sale_date <= now()
     GROUP BY (s.sale_date AT TIME ZONE 'America/Sao_Paulo')::date
  )
  UPDATE public.clients c SET
    visit_count = (SELECT count(*) FROM visits),
    last_service_date = (SELECT max(visited_at) FROM visits),
    total_spent = coalesce((SELECT sum(s.amount) FROM public.sales s WHERE s.client_id = c.id AND s.establishment_id = c.establishment_id AND s.deleted_at IS NULL), 0),
    updated_at = now()
  WHERE c.id = p_client_id;
END $$;
REVOKE ALL ON FUNCTION public.recalculate_client_stats(uuid) FROM PUBLIC, anon, authenticated;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT DISTINCT client_id AS id FROM public.appointments WHERE lower(coalesce(status,'')) = 'completed'
  LOOP PERFORM public.recalculate_client_stats(r.id); END LOOP;
END $$;