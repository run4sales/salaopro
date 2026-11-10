-- Test-only dependency tables for an EMPTY isolated PostgreSQL server.
-- Never apply this fixture to the application database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce($1='20000000-0000-0000-0000-000000000001'::uuid AND $2='super_admin',false) $$;
CREATE FUNCTION public.is_establishment_admin(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION public.get_subscription_state(uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.subscription_state',true),''),'active_paid') $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,user_id uuid,business_name text);
CREATE TABLE public.subscription_plans(id uuid PRIMARY KEY,slug text,name text);
INSERT INTO public.subscription_plans VALUES('50000000-0000-0000-0000-000000000001','individual','Individual');
CREATE TABLE public.subscriptions(id uuid PRIMARY KEY,establishment_id uuid,plan_id uuid,created_at timestamptz DEFAULT now());
CREATE TABLE public.sales(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),establishment_id uuid,service_id uuid,amount numeric,sale_date timestamptz,payment_method text,deleted_at timestamptz);
CREATE TABLE public.services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),establishment_id uuid,name text,kind text DEFAULT 'service');
CREATE TABLE public.expenses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),establishment_id uuid,description text,amount numeric,paid_amount numeric DEFAULT 0,status text DEFAULT 'pending',category text,due_date date,deleted_at timestamptz);
CREATE TABLE public.sale_professionals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),establishment_id uuid,sale_id uuid,professional_id uuid,commission_amount numeric);
CREATE TABLE public.professionals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),establishment_id uuid,name text);
CREATE TABLE public.clients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),establishment_id uuid,name text,phone text,last_service_date timestamptz);
CREATE TABLE public.appointments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),establishment_id uuid,client_id uuid,service_amount numeric,appointment_date timestamptz,status text);
CREATE TABLE public.appointment_services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),establishment_id uuid,appointment_id uuid,service_id uuid);
CREATE TABLE public.appointment_professionals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),establishment_id uuid,appointment_id uuid,professional_id uuid);
