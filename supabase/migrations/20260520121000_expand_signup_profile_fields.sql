ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS document TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT;

UPDATE public.profiles
SET
  document = COALESCE(NULLIF(document, ''), 'PENDENTE'),
  cep = COALESCE(NULLIF(cep, ''), 'PENDENTE'),
  street = COALESCE(NULLIF(street, ''), 'PENDENTE'),
  neighborhood = COALESCE(NULLIF(neighborhood, ''), 'PENDENTE'),
  city = COALESCE(NULLIF(city, ''), 'PENDENTE'),
  business_type = COALESCE(NULLIF(business_type, ''), 'Salao de beleza')
WHERE
  document IS NULL OR cep IS NULL OR street IS NULL OR neighborhood IS NULL OR city IS NULL OR business_type IS NULL
  OR document = '' OR cep = '' OR street = '' OR neighborhood = '' OR city = '' OR business_type = '';

ALTER TABLE public.profiles
  ALTER COLUMN document SET NOT NULL,
  ALTER COLUMN cep SET NOT NULL,
  ALTER COLUMN street SET NOT NULL,
  ALTER COLUMN neighborhood SET NOT NULL,
  ALTER COLUMN city SET NOT NULL,
  ALTER COLUMN business_type SET NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_business_type_check
  CHECK (business_type IN ('Salao de beleza', 'Barbeiro', 'Clinica Estetica', 'Trancista', 'Manicure'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    business_name,
    document,
    owner_name,
    phone,
    email,
    cep,
    street,
    neighborhood,
    city,
    business_type
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'Meu Salão'),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'document', ''), 'PENDENTE'),
    COALESCE(NEW.raw_user_meta_data ->> 'owner_name', NEW.raw_user_meta_data ->> 'full_name', 'Proprietário'),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, ''),
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'cep', ''), 'PENDENTE'),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'street', ''), 'PENDENTE'),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'neighborhood', ''), 'PENDENTE'),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'city', ''), 'PENDENTE'),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'business_type', ''), 'Salao de beleza')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'establishment');
  RETURN NEW;
END;
$$;
