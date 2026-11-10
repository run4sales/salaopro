CREATE TABLE public.beauty_ai_settings (
  establishment_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  monthly_limit integer NOT NULL DEFAULT 50,
  usage_count integer NOT NULL DEFAULT 0,
  usage_period text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.beauty_ai_settings TO authenticated;
GRANT ALL ON public.beauty_ai_settings TO service_role;

ALTER TABLE public.beauty_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY beauty_ai_settings_select ON public.beauty_ai_settings
  FOR SELECT TO authenticated
  USING (public.is_establishment_admin(establishment_id, auth.uid()));

CREATE TABLE public.beauty_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX beauty_ai_messages_establishment_created
  ON public.beauty_ai_messages (establishment_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.beauty_ai_messages TO authenticated;
GRANT ALL ON public.beauty_ai_messages TO service_role;

ALTER TABLE public.beauty_ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY beauty_ai_messages_select ON public.beauty_ai_messages
  FOR SELECT TO authenticated
  USING (public.is_establishment_admin(establishment_id, auth.uid()));

CREATE POLICY beauty_ai_messages_insert ON public.beauty_ai_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_establishment_admin(establishment_id, auth.uid()));

CREATE POLICY beauty_ai_messages_delete ON public.beauty_ai_messages
  FOR DELETE TO authenticated
  USING (public.is_establishment_admin(establishment_id, auth.uid()));

CREATE TABLE public.beauty_ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid,
  kind text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX beauty_ai_usage_log_establishment_created
  ON public.beauty_ai_usage_log (establishment_id, created_at);

GRANT ALL ON public.beauty_ai_usage_log TO service_role;

ALTER TABLE public.beauty_ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.beauty_ai_current_period()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
$$;

CREATE OR REPLACE FUNCTION public.beauty_ai_access_state(p_establishment uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.beauty_ai_settings%ROWTYPE;
  v_plan_slug text;
  v_state text;
  v_period text := public.beauty_ai_current_period();
  v_usage integer := 0;
  v_limit integer := 50;
  v_enabled boolean := false;
BEGIN
  SELECT s.slug INTO v_plan_slug
  FROM public.subscriptions sub
  JOIN public.subscription_plans s ON s.id = sub.plan_id
  WHERE sub.establishment_id = p_establishment
  ORDER BY sub.created_at DESC
  LIMIT 1;

  v_state := public.get_subscription_state(p_establishment);

  SELECT * INTO v_settings
  FROM public.beauty_ai_settings
  WHERE establishment_id = p_establishment;

  IF FOUND THEN
    v_enabled := v_settings.enabled;
    v_limit := v_settings.monthly_limit;
    v_usage := CASE WHEN v_settings.usage_period = v_period THEN v_settings.usage_count ELSE 0 END;
  END IF;

  RETURN jsonb_build_object(
    'establishment_id', p_establishment,
    'plan_slug', v_plan_slug,
    'subscription_state', v_state,
    'enabled', v_enabled,
    'monthly_limit', v_limit,
    'usage_count', v_usage,
    'usage_period', v_period,
    'remaining', GREATEST(v_limit - v_usage, 0),
    'plan_eligible', v_plan_slug IN ('profissional', 'empresa'),
    'subscription_regular', v_state IN ('trial_active', 'trial_expiring', 'active_paid', 'payment_pending', 'grace_active'),
    'allowed', v_enabled
      AND v_plan_slug IN ('profissional', 'empresa')
      AND v_state IN ('trial_active', 'trial_expiring', 'active_paid', 'payment_pending', 'grace_active')
      AND v_usage < v_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_beauty_ai_interaction(p_establishment uuid, p_user uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text := public.beauty_ai_current_period();
  v_state jsonb;
BEGIN
  INSERT INTO public.beauty_ai_settings (establishment_id)
  VALUES (p_establishment)
  ON CONFLICT (establishment_id) DO NOTHING;

  PERFORM 1 FROM public.beauty_ai_settings
  WHERE establishment_id = p_establishment
  FOR UPDATE;

  UPDATE public.beauty_ai_settings
  SET usage_count = 0, usage_period = v_period, updated_at = now()
  WHERE establishment_id = p_establishment
    AND (usage_period IS DISTINCT FROM v_period);

  v_state := public.beauty_ai_access_state(p_establishment);

  IF NOT (v_state ->> 'allowed')::boolean THEN
    RETURN v_state;
  END IF;

  UPDATE public.beauty_ai_settings
  SET usage_count = usage_count + 1, updated_at = now()
  WHERE establishment_id = p_establishment;

  INSERT INTO public.beauty_ai_usage_log (establishment_id, user_id, kind)
  VALUES (p_establishment, p_user, 'interaction');

  RETURN public.beauty_ai_access_state(p_establishment);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_beauty_ai_interaction(p_establishment uuid, p_user uuid DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.beauty_ai_settings
  SET usage_count = GREATEST(usage_count - 1, 0), updated_at = now()
  WHERE establishment_id = p_establishment
    AND usage_period = public.beauty_ai_current_period();

  INSERT INTO public.beauty_ai_usage_log (establishment_id, user_id, kind, detail)
  VALUES (p_establishment, p_user, 'refund', jsonb_build_object('reason', p_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_beauty_ai_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment uuid;
BEGIN
  SELECT p.id INTO v_establishment
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF v_establishment IS NULL THEN
    SELECT eu.establishment_id INTO v_establishment
    FROM public.establishment_users eu
    WHERE eu.user_id = auth.uid()
      AND eu.active = true
      AND eu.role IN ('owner', 'admin')
    ORDER BY eu.created_at
    LIMIT 1;
  END IF;

  IF v_establishment IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_establishment');
  END IF;

  RETURN public.beauty_ai_access_state(v_establishment);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_beauty_ai_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Acesso restrito ao super administrador';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.business_name)
    FROM (
      SELECT
        p.id AS establishment_id,
        p.business_name,
        sp.slug AS plan_slug,
        public.get_subscription_state(p.id) AS subscription_state,
        COALESCE(s.enabled, false) AS enabled,
        COALESCE(s.monthly_limit, 50) AS monthly_limit,
        CASE WHEN s.usage_period = public.beauty_ai_current_period() THEN s.usage_count ELSE 0 END AS usage_count,
        public.beauty_ai_current_period() AS usage_period,
        (SELECT count(*) FROM public.beauty_ai_messages m WHERE m.establishment_id = p.id) AS total_messages,
        (SELECT max(l.created_at) FROM public.beauty_ai_usage_log l WHERE l.establishment_id = p.id AND l.kind = 'interaction') AS last_used_at
      FROM public.profiles p
      LEFT JOIN public.subscriptions sub ON sub.establishment_id = p.id
      LEFT JOIN public.subscription_plans sp ON sp.id = sub.plan_id
      LEFT JOIN public.beauty_ai_settings s ON s.establishment_id = p.id
      ORDER BY p.business_name
    ) t
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_beauty_ai_access(
  p_establishment uuid,
  p_enabled boolean,
  p_monthly_limit integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Acesso restrito ao super administrador';
  END IF;

  IF p_monthly_limit IS NOT NULL AND (p_monthly_limit < 1 OR p_monthly_limit > 100000) THEN
    RAISE EXCEPTION 'Limite mensal inválido';
  END IF;

  INSERT INTO public.beauty_ai_settings (establishment_id, enabled, monthly_limit)
  VALUES (p_establishment, p_enabled, COALESCE(p_monthly_limit, 50))
  ON CONFLICT (establishment_id) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      monthly_limit = COALESCE(p_monthly_limit, public.beauty_ai_settings.monthly_limit),
      updated_at = now();

  RETURN public.beauty_ai_access_state(p_establishment);
END;
$$;

CREATE OR REPLACE FUNCTION public.beauty_ai_revenue_summary(p_establishment uuid, p_start timestamptz, p_end timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_span interval := p_end - p_start;
BEGIN
  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', p_start, 'end', p_end),
    'current', (
      SELECT jsonb_build_object(
        'realized_revenue', COALESCE(round(sum(s.amount)::numeric, 2), 0),
        'sales_count', count(*),
        'average_ticket', COALESCE(round((sum(s.amount) / NULLIF(count(*), 0))::numeric, 2), 0),
        'services_revenue', COALESCE(round(sum(s.amount) FILTER (WHERE sv.kind = 'service')::numeric, 2), 0),
        'products_revenue', COALESCE(round(sum(s.amount) FILTER (WHERE sv.kind = 'product')::numeric, 2), 0),
        'by_payment_method', COALESCE((
          SELECT jsonb_object_agg(COALESCE(pm, 'não informado'), total)
          FROM (
            SELECT s2.payment_method AS pm, round(sum(s2.amount)::numeric, 2) AS total
            FROM public.sales s2
            WHERE s2.establishment_id = p_establishment
              AND s2.deleted_at IS NULL
              AND s2.sale_date >= p_start AND s2.sale_date < p_end
            GROUP BY s2.payment_method
          ) m
        ), '{}'::jsonb)
      )
      FROM public.sales s
      LEFT JOIN public.services sv ON sv.id = s.service_id
      WHERE s.establishment_id = p_establishment
        AND s.deleted_at IS NULL
        AND s.sale_date >= p_start AND s.sale_date < p_end
    ),
    'previous_period', (
      SELECT jsonb_build_object(
        'realized_revenue', COALESCE(round(sum(s.amount)::numeric, 2), 0),
        'sales_count', count(*)
      )
      FROM public.sales s
      WHERE s.establishment_id = p_establishment
        AND s.deleted_at IS NULL
        AND s.sale_date >= p_start - v_span AND s.sale_date < p_start
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.beauty_ai_expenses_summary(p_establishment uuid, p_start date, p_end date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'period', jsonb_build_object('start', p_start, 'end', p_end),
      'total_amount', COALESCE(round(sum(e.amount)::numeric, 2), 0),
      'paid_amount', COALESCE(round(sum(e.paid_amount)::numeric, 2), 0),
      'pending_amount', COALESCE(round(sum(GREATEST(e.amount - e.paid_amount, 0)) FILTER (WHERE e.status NOT IN ('paid', 'confirmed', 'cancelled'))::numeric, 2), 0),
      'expenses_count', count(*),
      'pending_count', count(*) FILTER (WHERE e.status NOT IN ('paid', 'confirmed', 'cancelled') AND e.amount > e.paid_amount),
      'overdue_count', count(*) FILTER (WHERE e.status NOT IN ('paid', 'confirmed', 'cancelled') AND e.amount > e.paid_amount AND e.due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date),
      'overdue_amount', COALESCE(round(sum(GREATEST(e.amount - e.paid_amount, 0)) FILTER (WHERE e.status NOT IN ('paid', 'confirmed', 'cancelled') AND e.amount > e.paid_amount AND e.due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date)::numeric, 2), 0),
      'by_category', COALESCE((
        SELECT jsonb_object_agg(COALESCE(cat, 'sem categoria'), total)
        FROM (
          SELECT e2.category AS cat, round(sum(e2.amount)::numeric, 2) AS total
          FROM public.expenses e2
          WHERE e2.establishment_id = p_establishment
            AND e2.deleted_at IS NULL
            AND e2.due_date >= p_start AND e2.due_date <= p_end
          GROUP BY e2.category
        ) c
      ), '{}'::jsonb)
    )
    FROM public.expenses e
    WHERE e.establishment_id = p_establishment
      AND e.deleted_at IS NULL
      AND e.due_date >= p_start AND e.due_date <= p_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.beauty_ai_commissions_summary(p_establishment uuid, p_start timestamptz, p_end timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', p_start, 'end', p_end),
    'total_commissions', COALESCE((
      SELECT round(sum(sp.commission_amount)::numeric, 2)
      FROM public.sale_professionals sp
      JOIN public.sales s ON s.id = sp.sale_id
      WHERE sp.establishment_id = p_establishment
        AND s.deleted_at IS NULL
        AND s.sale_date >= p_start AND s.sale_date < p_end
    ), 0),
    'by_professional', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.commission_total DESC)
      FROM (
        SELECT
          pr.name AS professional_name,
          round(sum(sp.commission_amount)::numeric, 2) AS commission_total,
          count(DISTINCT sp.sale_id) AS sales_count
        FROM public.sale_professionals sp
        JOIN public.sales s ON s.id = sp.sale_id
        JOIN public.professionals pr ON pr.id = sp.professional_id
        WHERE sp.establishment_id = p_establishment
          AND s.deleted_at IS NULL
          AND s.sale_date >= p_start AND s.sale_date < p_end
        GROUP BY pr.name
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.beauty_ai_inactive_clients(p_establishment uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(days => GREATEST(p_days, 1));
BEGIN
  RETURN jsonb_build_object(
    'days_threshold', p_days,
    'total_inactive', (
      SELECT count(*) FROM public.clients c
      WHERE c.establishment_id = p_establishment
        AND (c.last_service_date IS NULL OR c.last_service_date < v_cutoff)
    ),
    'buckets', (
      SELECT jsonb_build_object(
        'never_attended', count(*) FILTER (WHERE c.last_service_date IS NULL),
        'between_30_60_days', count(*) FILTER (WHERE c.last_service_date < now() - interval '30 days' AND c.last_service_date >= now() - interval '60 days'),
        'between_60_90_days', count(*) FILTER (WHERE c.last_service_date < now() - interval '60 days' AND c.last_service_date >= now() - interval '90 days'),
        'over_90_days', count(*) FILTER (WHERE c.last_service_date < now() - interval '90 days')
      )
      FROM public.clients c
      WHERE c.establishment_id = p_establishment
        AND (c.last_service_date IS NULL OR c.last_service_date < v_cutoff)
    ),
    'without_future_appointment', (
      SELECT count(*) FROM public.clients c
      WHERE c.establishment_id = p_establishment
        AND (c.last_service_date IS NULL OR c.last_service_date < v_cutoff)
        AND NOT EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.establishment_id = p_establishment
            AND a.client_id = c.id
            AND a.appointment_date >= now()
            AND a.status IS DISTINCT FROM 'canceled'
        )
    ),
    'clients', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          c.name,
          c.phone,
          c.last_service_date,
          (NOT EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.establishment_id = p_establishment
              AND a.client_id = c.id
              AND a.appointment_date >= now()
              AND a.status IS DISTINCT FROM 'canceled'
          )) AS no_future_appointment
        FROM public.clients c
        WHERE c.establishment_id = p_establishment
          AND (c.last_service_date IS NULL OR c.last_service_date < v_cutoff)
        ORDER BY c.last_service_date ASC NULLS FIRST
        LIMIT 50
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.beauty_ai_top_services(p_establishment uuid, p_start timestamptz, p_end timestamptz, p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', p_start, 'end', p_end),
    'by_sales', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.revenue DESC)
      FROM (
        SELECT
          sv.name AS service_name,
          sv.kind,
          count(*) AS sales_count,
          round(sum(s.amount)::numeric, 2) AS revenue,
          round((sum(s.amount) / NULLIF(count(*), 0))::numeric, 2) AS average_ticket
        FROM public.sales s
        JOIN public.services sv ON sv.id = s.service_id
        WHERE s.establishment_id = p_establishment
          AND s.deleted_at IS NULL
          AND s.sale_date >= p_start AND s.sale_date < p_end
        GROUP BY sv.name, sv.kind
        ORDER BY revenue DESC
        LIMIT LEAST(p_limit, 50)
      ) t
    ), '[]'::jsonb),
    'by_appointments', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.appointments_count DESC)
      FROM (
        SELECT
          sv.name AS service_name,
          count(*) AS appointments_count
        FROM public.appointment_services aps
        JOIN public.appointments a ON a.id = aps.appointment_id
        JOIN public.services sv ON sv.id = aps.service_id
        WHERE aps.establishment_id = p_establishment
          AND a.status IS DISTINCT FROM 'canceled'
          AND a.appointment_date >= p_start AND a.appointment_date < p_end
        GROUP BY sv.name
        ORDER BY appointments_count DESC
        LIMIT LEAST(p_limit, 50)
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.beauty_ai_professional_performance(p_establishment uuid, p_start timestamptz, p_end timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', p_start, 'end', p_end),
    'professionals', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.revenue DESC)
      FROM (
        SELECT
          pr.name AS professional_name,
          count(DISTINCT a.id) FILTER (WHERE a.status IS DISTINCT FROM 'canceled') AS appointments_count,
          count(DISTINCT a.id) FILTER (WHERE a.status = 'canceled') AS canceled_count,
          COALESCE(round(sum(a.service_amount) FILTER (WHERE a.status IS DISTINCT FROM 'canceled')::numeric, 2), 0) AS revenue
        FROM public.appointment_professionals ap
        JOIN public.appointments a ON a.id = ap.appointment_id
        JOIN public.professionals pr ON pr.id = ap.professional_id
        WHERE ap.establishment_id = p_establishment
          AND a.appointment_date >= p_start AND a.appointment_date < p_end
        GROUP BY pr.name
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.beauty_ai_forecast(p_establishment uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'future_appointments', (
      SELECT jsonb_build_object(
        'count', count(*),
        'expected_amount', COALESCE(round(sum(a.service_amount)::numeric, 2), 0)
      )
      FROM public.appointments a
      WHERE a.establishment_id = p_establishment
        AND a.status IS DISTINCT FROM 'canceled'
        AND a.appointment_date >= now()
    ),
    'month_appointments', (
      SELECT jsonb_build_object(
        'count', count(*),
        'expected_amount', COALESCE(round(sum(a.service_amount)::numeric, 2), 0)
      )
      FROM public.appointments a
      WHERE a.establishment_id = p_establishment
        AND a.status IS DISTINCT FROM 'canceled'
        AND a.appointment_date >= now()
        AND a.appointment_date < (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month') AT TIME ZONE 'America/Sao_Paulo'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.beauty_ai_current_period() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.beauty_ai_access_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_beauty_ai_interaction(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_beauty_ai_interaction(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_beauty_ai_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_beauty_ai_report() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_beauty_ai_access(uuid, boolean, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.beauty_ai_revenue_summary(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.beauty_ai_expenses_summary(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.beauty_ai_commissions_summary(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.beauty_ai_inactive_clients(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.beauty_ai_top_services(uuid, timestamptz, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.beauty_ai_professional_performance(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.beauty_ai_forecast(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.beauty_ai_current_period() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_beauty_ai_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_beauty_ai_report() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_beauty_ai_access(uuid, boolean, integer) TO authenticated;

GRANT EXECUTE ON FUNCTION public.beauty_ai_access_state(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_beauty_ai_interaction(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_beauty_ai_interaction(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.beauty_ai_revenue_summary(uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.beauty_ai_expenses_summary(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.beauty_ai_commissions_summary(uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.beauty_ai_inactive_clients(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.beauty_ai_top_services(uuid, timestamptz, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.beauty_ai_professional_performance(uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.beauty_ai_forecast(uuid) TO service_role;