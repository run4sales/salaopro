CREATE OR REPLACE FUNCTION public.recalculate_client_stats(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_client_id IS NULL THEN RETURN; END IF;
  WITH visits AS (
    SELECT a.appointment_date AS visited_at
      FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id AND c.establishment_id = a.establishment_id
     WHERE a.client_id = p_client_id AND lower(coalesce(a.status,'')) = 'completed' AND a.appointment_date <= now()
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

CREATE OR REPLACE FUNCTION public.refresh_client_stats_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN PERFORM public.recalculate_client_stats(OLD.client_id); END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND (TG_OP = 'INSERT' OR NEW.client_id IS DISTINCT FROM OLD.client_id) THEN
    PERFORM public.recalculate_client_stats(NEW.client_id);
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.refresh_client_stats_trigger() FROM PUBLIC, anon, authenticated;

-- Sales trigger keeps only the goal update; client stats are recomputed from real records.
CREATE OR REPLACE FUNCTION public.update_client_stats_after_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.goals SET current_amount = current_amount + NEW.amount, updated_at = now()
    WHERE establishment_id = NEW.establishment_id AND month = EXTRACT(MONTH FROM NEW.sale_date) AND year = EXTRACT(YEAR FROM NEW.sale_date);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS zz_refresh_client_stats ON public.sales;
CREATE TRIGGER zz_refresh_client_stats AFTER INSERT OR DELETE OR UPDATE OF client_id, amount, sale_date, deleted_at, appointment_id ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.refresh_client_stats_trigger();
DROP TRIGGER IF EXISTS zz_refresh_client_stats ON public.appointments;
CREATE TRIGGER zz_refresh_client_stats AFTER INSERT OR DELETE OR UPDATE OF client_id, status, appointment_date ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.refresh_client_stats_trigger();

-- Reconcile existing clients that have any history or stored counters.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.clients
            WHERE coalesce(visit_count,0) <> 0 OR last_service_date IS NOT NULL OR coalesce(total_spent,0) <> 0
               OR EXISTS (SELECT 1 FROM public.sales s WHERE s.client_id = clients.id)
               OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.client_id = clients.id)
  LOOP PERFORM public.recalculate_client_stats(r.id); END LOOP;
END $$;