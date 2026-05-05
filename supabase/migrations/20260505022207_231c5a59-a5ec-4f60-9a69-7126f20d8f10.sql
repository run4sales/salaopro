-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'establishment', 'super_admin');

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT,
  plan TEXT DEFAULT 'trial',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  last_service_date TIMESTAMPTZ,
  total_spent DECIMAL(10,2) DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  notes TEXT,
  email TEXT,
  gender TEXT CHECK (gender IN ('masculino', 'feminino', 'outro')),
  birth_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  professional_id UUID,
  appointment_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  target_amount DECIMAL(10,2) NOT NULL,
  current_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, month, year)
);

CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inactive_days_threshold INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (establishment_id)
);

CREATE TABLE public.service_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  service_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, professional_id)
);

CREATE INDEX idx_professionals_establishment ON public.professionals (establishment_id);
CREATE INDEX idx_appointments_est_prof_date ON public.appointments (establishment_id, professional_id, appointment_date);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_professionals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishments can manage their clients" ON public.clients FOR ALL USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Super admins can view all clients" ON public.clients FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishments can manage their services" ON public.services FOR ALL USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Super admins can view all services" ON public.services FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishments can manage their appointments" ON public.appointments FOR ALL USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Super admins can view all appointments" ON public.appointments FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishments can manage their sales" ON public.sales FOR ALL USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Super admins can view all sales" ON public.sales FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishments can manage their goals" ON public.goals FOR ALL USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Super admins can view all goals" ON public.goals FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishments can manage their settings" ON public.settings FOR ALL USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Establishments can manage their professionals" ON public.professionals FOR ALL
  USING (establishment_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()));
CREATE POLICY "Super admins can view all professionals" ON public.professionals FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishments can manage their service_professionals" ON public.service_professionals FOR ALL
  USING (establishment_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()));
CREATE POLICY "Super admins can view all service_professionals" ON public.service_professionals FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- Triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_professionals_updated_at BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
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
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'establishment');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_client_stats_after_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.clients SET last_service_date = NEW.sale_date, total_spent = total_spent + NEW.amount, visit_count = visit_count + 1, updated_at = now() WHERE id = NEW.client_id;
  UPDATE public.goals SET current_amount = current_amount + NEW.amount, updated_at = now()
    WHERE establishment_id = NEW.establishment_id AND month = EXTRACT(MONTH FROM NEW.sale_date) AND year = EXTRACT(YEAR FROM NEW.sale_date);
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_client_stats_after_sale AFTER INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_client_stats_after_sale();

-- Slug support
CREATE EXTENSION IF NOT EXISTS unaccent;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_slug_unique ON public.profiles (slug) WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT trim(both '-' FROM regexp_replace(regexp_replace(lower(unaccent(coalesce($1, ''))), '[^a-z0-9]+' , '-', 'g'), '-+', '-', 'g')) $$;

CREATE OR REPLACE FUNCTION public.ensure_profile_slug()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE base text; candidate text; i int := 2;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF new.slug IS NULL OR length(trim(new.slug)) = 0 THEN
      base := public.slugify(coalesce(new.business_name, ''));
      IF base = '' THEN base := 'salao'; END IF;
    ELSE
      base := public.slugify(new.slug);
    END IF;
    candidate := base;
    WHILE EXISTS(SELECT 1 FROM public.profiles p WHERE p.slug = candidate AND p.id <> new.id) LOOP
      candidate := base || '-' || i::text; i := i + 1;
    END LOOP;
    new.slug := candidate;
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER trg_profiles_ensure_slug BEFORE INSERT OR UPDATE OF slug, business_name ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_slug();

-- Public RPCs
CREATE OR REPLACE FUNCTION public.get_public_catalog(establishment UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE services_json JSON; professionals_json JSON;
BEGIN
  SELECT COALESCE(json_agg(json_build_object('id', id, 'name', name, 'price', price, 'duration', duration_minutes) ORDER BY name), '[]'::json)
  INTO services_json FROM public.services WHERE establishment_id = establishment AND active = true;
  SELECT COALESCE(json_agg(json_build_object('id', id, 'name', name) ORDER BY name), '[]'::json)
  INTO professionals_json FROM public.professionals WHERE establishment_id = establishment AND active = true;
  RETURN json_build_object('services', services_json, 'professionals', professionals_json);
END; $$;

CREATE OR REPLACE FUNCTION public.get_public_availability(establishment UUID, professional UUID, day DATE)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE times JSON;
BEGIN
  SELECT COALESCE(json_agg(appointment_date ORDER BY appointment_date), '[]'::json)
  INTO times FROM public.appointments
  WHERE establishment_id = establishment AND professional_id = professional
    AND appointment_date >= (day::timestamptz) AND appointment_date < ((day + 1)::timestamptz)
    AND COALESCE(status, 'scheduled') <> 'canceled';
  RETURN json_build_object('booked', times);
END; $$;

CREATE OR REPLACE FUNCTION public.create_public_booking(establishment UUID, client_name TEXT, p_phone TEXT, service UUID, professional UUID, start_time TIMESTAMPTZ, notes TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE svc RECORD; prof RECORD; existing_client RECORD; appt_id UUID; conflict_exists BOOLEAN;
BEGIN
  SELECT id, duration_minutes INTO svc FROM public.services WHERE id = service AND establishment_id = establishment AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço inválido'; END IF;
  SELECT id INTO prof FROM public.professionals WHERE id = professional AND establishment_id = establishment AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profissional inválido'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.appointments WHERE establishment_id = establishment AND professional_id = professional AND appointment_date = start_time AND COALESCE(status, 'scheduled') <> 'canceled') INTO conflict_exists;
  IF conflict_exists THEN RAISE EXCEPTION 'Horário indisponível'; END IF;
  SELECT id INTO existing_client FROM public.clients WHERE public.clients.establishment_id = establishment AND public.clients.phone = p_phone LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.clients (establishment_id, name, phone) VALUES (establishment, COALESCE(client_name, 'Cliente'), COALESCE(p_phone, '')) RETURNING id INTO existing_client;
  END IF;
  INSERT INTO public.appointments (establishment_id, client_id, service_id, professional_id, appointment_date, status, notes)
  VALUES (establishment, existing_client.id, service, professional, start_time, 'scheduled', notes) RETURNING id INTO appt_id;
  RETURN appt_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_public_service_professionals(establishment uuid, service uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE professionals_json JSON;
BEGIN
  SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.name), '[]'::json)
  INTO professionals_json FROM public.professionals p
  INNER JOIN public.service_professionals sp ON sp.professional_id = p.id
  WHERE p.establishment_id = establishment AND sp.service_id = service AND p.active = true;
  RETURN professionals_json;
END; $$;