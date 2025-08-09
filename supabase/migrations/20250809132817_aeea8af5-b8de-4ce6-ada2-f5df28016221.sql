-- Fix the remaining security warning for handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, business_name, owner_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'Meu Salão'),
    COALESCE(NEW.raw_user_meta_data ->> 'owner_name', NEW.raw_user_meta_data ->> 'full_name', 'Proprietário'),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, ''),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'establishment');
  
  RETURN NEW;
END;
$$;