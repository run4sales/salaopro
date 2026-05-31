-- Add product fields to services table (services and products share same table differentiated by kind)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;

-- Trigger to auto-decrement product stock on sale insert
CREATE OR REPLACE FUNCTION public.decrement_product_stock_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
BEGIN
  SELECT kind INTO v_kind FROM public.services WHERE id = NEW.service_id;
  IF v_kind = 'product' THEN
    UPDATE public.services
       SET stock_quantity = GREATEST(0, stock_quantity - 1),
           updated_at = now()
     WHERE id = NEW.service_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_product_stock ON public.sales;
CREATE TRIGGER trg_decrement_product_stock
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.decrement_product_stock_on_sale();