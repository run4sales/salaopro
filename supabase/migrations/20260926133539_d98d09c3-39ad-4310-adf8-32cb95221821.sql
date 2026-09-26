ALTER TABLE public.clients ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS whatsapp text, ADD COLUMN IF NOT EXISTS cpf text, ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS client_fields jsonb NOT NULL DEFAULT '{"phone":true,"whatsapp":false,"email":true,"cpf":false,"birth_date":true,"address":false,"gender":true,"acquisition_source":true,"notes":true}'::jsonb;
CREATE OR REPLACE FUNCTION public.validate_contact_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$ DECLARE v_error text; BEGIN
 IF TG_TABLE_NAME = 'clients' THEN
  IF TG_OP='INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
   v_error := public.contact_phone_error(NEW.phone, false);
   IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
   NEW.phone := nullif(public.normalize_br_phone(NEW.phone), '');
  END IF;
  IF TG_OP='INSERT' OR NEW.whatsapp IS DISTINCT FROM OLD.whatsapp THEN
   v_error := public.contact_phone_error(NEW.whatsapp, false);
   IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
   NEW.whatsapp := nullif(public.normalize_br_phone(NEW.whatsapp), '');
  END IF;
  IF TG_OP='INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
   v_error := public.contact_email_error(NEW.email, false);
   IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
   NEW.email := nullif(lower(btrim(NEW.email)), '');
  END IF;
 ELSIF TG_TABLE_NAME = 'profiles' THEN
  IF TG_OP='INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
   v_error := public.contact_phone_error(NEW.phone, true); IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
   NEW.phone := public.normalize_br_phone(NEW.phone);
  END IF;
  IF TG_OP='INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
   v_error := public.contact_email_error(NEW.email, true); IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
   NEW.email := lower(btrim(NEW.email));
  END IF;
 ELSIF TG_TABLE_NAME = 'establishment_users' THEN
  IF TG_OP='INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
   v_error := public.contact_email_error(NEW.email, true); IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
   NEW.email := lower(btrim(NEW.email));
  END IF;
 ELSIF TG_TABLE_NAME = 'subscriptions' THEN
  IF TG_OP='INSERT' OR NEW.billing_email IS DISTINCT FROM OLD.billing_email THEN
   v_error := public.contact_email_error(NEW.billing_email, false); IF v_error IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=v_error, ERRCODE='22023'; END IF;
   NEW.billing_email := nullif(lower(btrim(NEW.billing_email)), '');
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TABLE public.client_benefits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id), client_id uuid NOT NULL REFERENCES public.clients(id), kind text NOT NULL CHECK (kind IN ('package','combo','subscription')), name text NOT NULL, price numeric NOT NULL DEFAULT 0 CHECK (price >= 0), purchased_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz, ended_at timestamptz, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')), billing_period text, next_billing_at timestamptz, items jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT client_benefits_items_array CHECK (jsonb_typeof(items) = 'array')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_benefits TO authenticated;
GRANT ALL ON public.client_benefits TO service_role;
ALTER TABLE public.client_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read client benefits" ON public.client_benefits FOR SELECT TO authenticated USING (public.is_establishment_member(establishment_id, auth.uid()) OR public.is_establishment_admin(establishment_id, auth.uid()));
CREATE POLICY "Managers manage client benefits" ON public.client_benefits FOR ALL TO authenticated USING (public.is_establishment_admin(establishment_id, auth.uid())) WITH CHECK (public.is_establishment_admin(establishment_id, auth.uid()));
CREATE TABLE public.client_benefit_uses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id), benefit_id uuid NOT NULL REFERENCES public.client_benefits(id), client_id uuid NOT NULL REFERENCES public.clients(id), service_id uuid REFERENCES public.services(id), appointment_id uuid REFERENCES public.appointments(id), item_name text NOT NULL, used_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_benefit_uses TO authenticated;
GRANT ALL ON public.client_benefit_uses TO service_role;
ALTER TABLE public.client_benefit_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read benefit uses" ON public.client_benefit_uses FOR SELECT TO authenticated USING (public.is_establishment_member(establishment_id, auth.uid()) OR public.is_establishment_admin(establishment_id, auth.uid()));
CREATE POLICY "Managers manage benefit uses" ON public.client_benefit_uses FOR ALL TO authenticated USING (public.is_establishment_admin(establishment_id, auth.uid())) WITH CHECK (public.is_establishment_admin(establishment_id, auth.uid()));
CREATE OR REPLACE FUNCTION public.guard_client_benefit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benefit public.client_benefits%ROWTYPE; v_client_establishment uuid; v_service_establishment uuid; v_appointment_client uuid; v_appointment_establishment uuid; v_limit integer; v_used integer;
BEGIN
 IF TG_TABLE_NAME = 'client_benefits' THEN
  SELECT establishment_id INTO v_client_establishment FROM public.clients WHERE id = NEW.client_id;
  IF v_client_establishment IS DISTINCT FROM NEW.establishment_id THEN RAISE EXCEPTION 'Cliente não pertence ao salão'; END IF;
  IF TG_OP='UPDATE' AND (NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.establishment_id IS DISTINCT FROM OLD.establishment_id OR NEW.kind IS DISTINCT FROM OLD.kind) THEN RAISE EXCEPTION 'Vínculo do benefício não pode ser alterado'; END IF;
 ELSE
  SELECT * INTO v_benefit FROM public.client_benefits WHERE id=NEW.benefit_id FOR UPDATE;
  IF NOT FOUND OR v_benefit.client_id IS DISTINCT FROM NEW.client_id OR v_benefit.establishment_id IS DISTINCT FROM NEW.establishment_id OR v_benefit.kind NOT IN ('package','combo') THEN RAISE EXCEPTION 'Benefício inválido para este cliente'; END IF;
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Utilizações registradas não podem ser alteradas'; END IF;
  IF v_benefit.status <> 'active' OR (v_benefit.expires_at IS NOT NULL AND v_benefit.expires_at < now()) THEN RAISE EXCEPTION 'Benefício indisponível'; END IF;
  IF NEW.service_id IS NOT NULL THEN SELECT establishment_id INTO v_service_establishment FROM public.services WHERE id=NEW.service_id; IF v_service_establishment IS DISTINCT FROM NEW.establishment_id THEN RAISE EXCEPTION 'Serviço de outro salão'; END IF; END IF;
  IF NEW.appointment_id IS NOT NULL THEN SELECT client_id,establishment_id INTO v_appointment_client,v_appointment_establishment FROM public.appointments WHERE id=NEW.appointment_id; IF v_appointment_client IS DISTINCT FROM NEW.client_id OR v_appointment_establishment IS DISTINCT FROM NEW.establishment_id THEN RAISE EXCEPTION 'Agendamento de outro cliente'; END IF; END IF;
  SELECT (item->>'quantity')::integer INTO v_limit FROM jsonb_array_elements(v_benefit.items) item WHERE item->>'name'=NEW.item_name LIMIT 1;
  IF v_limit IS NULL OR v_limit < 1 THEN RAISE EXCEPTION 'Item não contratado'; END IF;
  SELECT count(*) INTO v_used FROM public.client_benefit_uses WHERE benefit_id=NEW.benefit_id AND item_name=NEW.item_name;
  IF v_used >= v_limit THEN RAISE EXCEPTION 'Saldo de sessões esgotado'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_client_benefit BEFORE INSERT OR UPDATE ON public.client_benefits FOR EACH ROW EXECUTE FUNCTION public.guard_client_benefit();
CREATE TRIGGER guard_client_benefit_use BEFORE INSERT OR UPDATE ON public.client_benefit_uses FOR EACH ROW EXECUTE FUNCTION public.guard_client_benefit();
CREATE TRIGGER update_client_benefits_timestamp BEFORE UPDATE ON public.client_benefits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_benefit_uses_timestamp BEFORE UPDATE ON public.client_benefit_uses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
REVOKE ALL ON FUNCTION public.guard_client_benefit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_client_benefit() TO service_role;
CREATE INDEX client_benefits_client_idx ON public.client_benefits(establishment_id,client_id,purchased_at DESC);
CREATE INDEX client_benefit_uses_benefit_idx ON public.client_benefit_uses(benefit_id,item_name);
