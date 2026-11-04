-- Test-only dependency tables for an EMPTY isolated PostgreSQL server.
-- Never apply this fixture to the application database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb);
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce($1='20000000-0000-0000-0000-000000000001'::uuid AND $2='super_admin',false) $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,user_id uuid,business_name text);
CREATE TABLE public.subscription_plans(id uuid PRIMARY KEY,slug text,name text);
INSERT INTO public.subscription_plans VALUES('50000000-0000-0000-0000-000000000001','individual','Individual');
CREATE TABLE public.subscriptions(id uuid PRIMARY KEY,establishment_id uuid,plan_id uuid);
CREATE TABLE public.subscription_payments(id uuid PRIMARY KEY,establishment_id uuid,subscription_id uuid,asaas_payment_id text,value numeric,status text,due_date date,payment_date timestamptz,raw jsonb,payment_source text DEFAULT 'asaas',created_at timestamptz DEFAULT now());
CREATE FUNCTION public.contact_phone_error(text,boolean) RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
CREATE FUNCTION public.normalize_br_phone(text) RETURNS text LANGUAGE sql AS $$ SELECT $1 $$;