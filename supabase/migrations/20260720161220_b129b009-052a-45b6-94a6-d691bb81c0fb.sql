
CREATE OR REPLACE FUNCTION public.recalculate_sale_commissions(_establishment_id uuid DEFAULT NULL)
RETURNS TABLE(sales_affected int, rows_updated int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_updated int := 0;
  v_sales_affected int := 0;
BEGIN
  WITH counts AS (
    SELECT sp.sale_id, COUNT(*)::int AS n
    FROM public.sale_professionals sp
    GROUP BY sp.sale_id
  ),
  target AS (
    SELECT sp.id,
           ROUND(
             (COALESCE(s.amount, 0)::numeric / c.n) * (sp.commission_percentage / 100.0),
             2
           ) AS new_amount,
           sp.sale_id
    FROM public.sale_professionals sp
    JOIN counts c ON c.sale_id = sp.sale_id
    JOIN public.sales s ON s.id = sp.sale_id
    WHERE c.n > 1
      AND (_establishment_id IS NULL OR sp.establishment_id = _establishment_id)
  ),
  updated AS (
    UPDATE public.sale_professionals sp
       SET commission_amount = t.new_amount
      FROM target t
     WHERE sp.id = t.id
       AND sp.commission_amount IS DISTINCT FROM t.new_amount
    RETURNING sp.sale_id
  )
  SELECT COUNT(*)::int, COUNT(DISTINCT sale_id)::int
    INTO v_rows_updated, v_sales_affected
  FROM updated;

  RETURN QUERY SELECT v_sales_affected, v_rows_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_sale_commissions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_sale_commissions(uuid) TO service_role;

-- Run once now to fix historical data across all establishments
SELECT * FROM public.recalculate_sale_commissions(NULL);
