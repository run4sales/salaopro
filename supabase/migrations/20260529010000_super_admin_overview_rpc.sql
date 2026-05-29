-- Centralized Super Admin data source. Uses SECURITY DEFINER so the admin panel
-- does not render empty when table RLS policies hide tenant data from direct selects.
CREATE OR REPLACE FUNCTION public.get_super_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_admin boolean;
  result jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text = 'super_admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Acesso restrito ao Super Admin.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'profiles', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'business_name', p.business_name,
          'owner_name', p.owner_name,
          'email', p.email,
          'phone', p.phone,
          'created_at', p.created_at,
          'last_access_at', p.last_access_at,
          'selected_plan_slug', p.selected_plan_slug
        )
        ORDER BY p.created_at DESC
      )
      FROM public.profiles p
    ), '[]'::jsonb),
    'subscriptions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'establishment_id', s.establishment_id,
          'status', s.status,
          'plan_id', s.plan_id,
          'monthly_amount', s.monthly_amount,
          'started_at', s.started_at,
          'trial_ends_at', s.trial_ends_at,
          'next_billing_at', s.next_billing_at,
          'canceled_at', s.canceled_at,
          'asaas_subscription_id', s.asaas_subscription_id,
          'plan', CASE WHEN sp.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', sp.id,
            'name', sp.name,
            'slug', sp.slug,
            'monthly_price', sp.monthly_price
          ) END
        )
        ORDER BY s.started_at DESC
      )
      FROM public.subscriptions s
      LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
    ), '[]'::jsonb),
    'plans', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', sp.id,
          'name', sp.name,
          'slug', sp.slug,
          'monthly_price', sp.monthly_price,
          'active', sp.active,
          'display_order', sp.display_order
        )
        ORDER BY sp.display_order ASC, sp.name ASC
      )
      FROM public.subscription_plans sp
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_super_admin_overview() TO authenticated;
