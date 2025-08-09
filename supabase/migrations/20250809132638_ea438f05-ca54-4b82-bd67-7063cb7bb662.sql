-- Fix security warnings - update functions with proper search_path
CREATE OR REPLACE FUNCTION public.update_client_stats_after_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  -- Update client's last service date, total spent, and visit count
  UPDATE public.clients 
  SET 
    last_service_date = NEW.sale_date,
    total_spent = total_spent + NEW.amount,
    visit_count = visit_count + 1,
    updated_at = now()
  WHERE id = NEW.client_id;
  
  -- Update goal current amount
  UPDATE public.goals
  SET 
    current_amount = current_amount + NEW.amount,
    updated_at = now()
  WHERE 
    establishment_id = NEW.establishment_id 
    AND month = EXTRACT(MONTH FROM NEW.sale_date)
    AND year = EXTRACT(YEAR FROM NEW.sale_date);
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;