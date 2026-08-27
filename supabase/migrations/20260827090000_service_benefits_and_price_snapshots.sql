-- Historical appointment pricing and customer service benefits.
-- Additive migration: no operational or financial records are deleted.
ALTER TABLE public.appointment_services
  ADD COLUMN IF NOT EXISTS unit_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS price_source text NOT NULL DEFAULT 'service'
    CHECK (price_source IN ('service','negotiated')),
  ADD COLUMN IF NOT EXISTS benefit_type text CHECK (benefit_type IN ('package','subscription')),
  ADD COLUMN IF NOT EXISTS benefit_credit_id uuid;

-- Preserve the best historical value available. For legacy single-service appointments,
-- service_amount is the historical snapshot; only otherwise fall back to catalog price.
UPDATE public.appointment_services aps
SET unit_price = CASE
  WHEN a.service_amount IS NOT NULL AND (SELECT count(*) FROM public.appointment_services x WHERE x.appointment_id = aps.appointment_id) = 1
    THEN a.service_amount
  ELSE s.price
END,
price_source = CASE WHEN a.service_amount IS NOT NULL THEN 'negotiated' ELSE 'service' END
FROM public.appointments a, public.services s
WHERE a.id = aps.appointment_id AND s.id = aps.service_id AND aps.unit_price IS NULL;
ALTER TABLE public.appointment_services ALTER COLUMN unit_price SET NOT NULL;
ALTER TABLE public.appointment_services ADD CONSTRAINT appointment_services_unit_price_nonnegative CHECK (unit_price >= 0) NOT VALID;
ALTER TABLE public.appointment_services VALIDATE CONSTRAINT appointment_services_unit_price_nonnegative;

-- Price snapshots already copied to a comanda cannot be silently edited.
CREATE OR REPLACE FUNCTION public.guard_appointment_service_financial_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE' OR OLD.unit_price IS DISTINCT FROM NEW.unit_price) AND EXISTS (
    SELECT 1 FROM public.comandas c WHERE c.appointment_id = OLD.appointment_id
  ) THEN RAISE EXCEPTION 'O valor não pode ser alterado após a criação da comanda'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS guard_appointment_service_financial_snapshot ON public.appointment_services;
CREATE TRIGGER guard_appointment_service_financial_snapshot BEFORE UPDATE OR DELETE ON public.appointment_services
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_service_financial_snapshot();

CREATE TABLE public.service_packages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120), description text,
 price numeric(12,2) NOT NULL CHECK(price >= 0), validity_days integer NOT NULL CHECK(validity_days > 0),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(establishment_id,name)
);
CREATE TABLE public.service_package_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 package_id uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
 service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT, quantity integer NOT NULL CHECK(quantity > 0),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(package_id,service_id)
);
CREATE TABLE public.customer_packages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT, package_id uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE RESTRICT,
 purchased_at timestamptz NOT NULL DEFAULT now(), starts_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 amount_paid numeric(12,2) NOT NULL CHECK(amount_paid >= 0), status text NOT NULL DEFAULT 'active' CHECK(status IN ('pending','active','expired','cancelled')),
 sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at > starts_at)
);
CREATE TABLE public.customer_package_credits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 customer_package_id uuid NOT NULL REFERENCES public.customer_packages(id) ON DELETE CASCADE,
 service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT, contracted integer NOT NULL CHECK(contracted > 0), used integer NOT NULL DEFAULT 0 CHECK(used >= 0 AND used <= contracted),
 UNIQUE(customer_package_id,service_id)
);

CREATE TABLE public.customer_subscription_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120), description text, price numeric(12,2) NOT NULL CHECK(price >= 0),
 periodicity text NOT NULL DEFAULT 'monthly' CHECK(periodicity IN ('monthly')), status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(establishment_id,name)
);
CREATE TABLE public.customer_subscription_plan_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 plan_id uuid NOT NULL REFERENCES public.customer_subscription_plans(id) ON DELETE CASCADE,
 service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT, quantity integer NOT NULL CHECK(quantity > 0), UNIQUE(plan_id,service_id)
);
CREATE TABLE public.customer_service_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT, plan_id uuid NOT NULL REFERENCES public.customer_subscription_plans(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','past_due','cancelled')),
 starts_at timestamptz NOT NULL DEFAULT now(), next_renewal_at timestamptz, cancelled_at timestamptz,
 asaas_customer_id text, asaas_subscription_id text UNIQUE, billing_reference text,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.customer_subscription_cycles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES public.customer_service_subscriptions(id) ON DELETE CASCADE,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','closed','cancelled')),
 asaas_payment_id text UNIQUE, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CHECK(ends_at > starts_at), UNIQUE(subscription_id,starts_at)
);
CREATE TABLE public.customer_subscription_credits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 cycle_id uuid NOT NULL REFERENCES public.customer_subscription_cycles(id) ON DELETE CASCADE,
 service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT, contracted integer NOT NULL CHECK(contracted > 0), used integer NOT NULL DEFAULT 0 CHECK(used >= 0 AND used <= contracted), UNIQUE(cycle_id,service_id)
);
CREATE TABLE public.service_benefit_consumptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), establishment_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT, service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
 benefit_type text NOT NULL CHECK(benefit_type IN ('package','subscription')), package_credit_id uuid REFERENCES public.customer_package_credits(id) ON DELETE RESTRICT,
 subscription_credit_id uuid REFERENCES public.customer_subscription_credits(id) ON DELETE RESTRICT,
 appointment_id uuid REFERENCES public.appointments(id) ON DELETE RESTRICT, comanda_id uuid REFERENCES public.comandas(id) ON DELETE RESTRICT,
 professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL, reference_value numeric(12,2) NOT NULL CHECK(reference_value >= 0),
 consumed_at timestamptz NOT NULL DEFAULT now(), consumed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 reversed_at timestamptz, reversed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 CHECK ((benefit_type='package' AND package_credit_id IS NOT NULL AND subscription_credit_id IS NULL) OR (benefit_type='subscription' AND subscription_credit_id IS NOT NULL AND package_credit_id IS NULL))
);
ALTER TABLE public.comanda_items
  ADD COLUMN IF NOT EXISTS payment_source text NOT NULL DEFAULT 'normal' CHECK(payment_source IN ('normal','package','subscription','client_credit')),
  ADD COLUMN IF NOT EXISTS reference_unit_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS benefit_consumption_id uuid REFERENCES public.service_benefit_consumptions(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX service_benefit_one_active_consumption_per_appointment_service ON public.service_benefit_consumptions(appointment_id,service_id) WHERE reversed_at IS NULL AND appointment_id IS NOT NULL;
CREATE INDEX service_packages_tenant ON public.service_packages(establishment_id,status);
CREATE INDEX customer_packages_client ON public.customer_packages(establishment_id,client_id,status,expires_at);
CREATE INDEX customer_subscriptions_client ON public.customer_service_subscriptions(establishment_id,client_id,status);
CREATE INDEX benefit_consumptions_history ON public.service_benefit_consumptions(establishment_id,client_id,consumed_at DESC);

-- Verify denormalized tenant keys on every write; prevents cross-tenant FK composition even for service-role callers.
CREATE OR REPLACE FUNCTION public.validate_service_benefit_tenant() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE expected uuid;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'service_package_items' THEN SELECT establishment_id INTO expected FROM service_packages WHERE id=NEW.package_id;
 WHEN 'customer_packages' THEN SELECT establishment_id INTO expected FROM clients WHERE id=NEW.client_id;
 WHEN 'customer_package_credits' THEN SELECT establishment_id INTO expected FROM customer_packages WHERE id=NEW.customer_package_id;
 WHEN 'customer_subscription_plan_items' THEN SELECT establishment_id INTO expected FROM customer_subscription_plans WHERE id=NEW.plan_id;
 WHEN 'customer_service_subscriptions' THEN SELECT establishment_id INTO expected FROM clients WHERE id=NEW.client_id;
 WHEN 'customer_subscription_cycles' THEN SELECT establishment_id INTO expected FROM customer_service_subscriptions WHERE id=NEW.subscription_id;
 WHEN 'customer_subscription_credits' THEN SELECT establishment_id INTO expected FROM customer_subscription_cycles WHERE id=NEW.cycle_id;
 WHEN 'service_benefit_consumptions' THEN SELECT establishment_id INTO expected FROM clients WHERE id=NEW.client_id;
 END CASE;
 IF expected IS NULL OR expected <> NEW.establishment_id THEN RAISE EXCEPTION 'Referência entre estabelecimentos não permitida'; END IF;
 IF TG_TABLE_NAME IN ('service_package_items','customer_package_credits','customer_subscription_plan_items','customer_subscription_credits','service_benefit_consumptions')
    AND NOT EXISTS(SELECT 1 FROM services WHERE id=NEW.service_id AND establishment_id=NEW.establishment_id)
 THEN RAISE EXCEPTION 'Serviço de outro estabelecimento'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['service_package_items','customer_packages','customer_package_credits','customer_subscription_plan_items','customer_service_subscriptions','customer_subscription_cycles','customer_subscription_credits','service_benefit_consumptions'] LOOP EXECUTE format('CREATE TRIGGER validate_tenant BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.validate_service_benefit_tenant()',t); END LOOP; END $$;

-- Atomic package sale: snapshot package contents into credits.
CREATE OR REPLACE FUNCTION public.sell_service_package(p_package_id uuid,p_client_id uuid,p_amount_paid numeric DEFAULT NULL,p_starts_at timestamptz DEFAULT now(),p_sale_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p service_packages; result uuid;
BEGIN SELECT * INTO p FROM service_packages WHERE id=p_package_id AND status='active'; IF NOT FOUND THEN RAISE EXCEPTION 'Pacote indisponível'; END IF;
 IF NOT is_establishment_member(p.establishment_id,auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF NOT EXISTS(SELECT 1 FROM clients WHERE id=p_client_id AND establishment_id=p.establishment_id) THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
 INSERT INTO customer_packages(establishment_id,client_id,package_id,starts_at,expires_at,amount_paid,sale_id,created_by)
 VALUES(p.establishment_id,p_client_id,p.id,p_starts_at,p_starts_at+make_interval(days=>p.validity_days),coalesce(p_amount_paid,p.price),p_sale_id,auth.uid()) RETURNING id INTO result;
 INSERT INTO customer_package_credits(establishment_id,customer_package_id,service_id,contracted)
 SELECT p.establishment_id,result,service_id,quantity FROM service_package_items WHERE package_id=p.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pacote sem serviços'; END IF; RETURN result; END $$;

CREATE OR REPLACE FUNCTION public.open_customer_subscription_cycle(p_subscription_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_asaas_payment_id text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s customer_service_subscriptions; result uuid;
BEGIN SELECT * INTO s FROM customer_service_subscriptions WHERE id=p_subscription_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Assinatura não encontrada'; END IF;
 IF auth.uid() IS NOT NULL AND NOT is_establishment_member(s.establishment_id,auth.uid()) AND NOT has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 UPDATE customer_subscription_cycles SET status='closed' WHERE subscription_id=s.id AND status='active';
 INSERT INTO customer_subscription_cycles(establishment_id,subscription_id,starts_at,ends_at,status,asaas_payment_id,paid_at) VALUES(s.establishment_id,s.id,p_starts_at,p_ends_at,'active',p_asaas_payment_id,now()) ON CONFLICT(subscription_id,starts_at) DO UPDATE SET status='active',paid_at=coalesce(customer_subscription_cycles.paid_at,now()),asaas_payment_id=coalesce(EXCLUDED.asaas_payment_id,customer_subscription_cycles.asaas_payment_id) RETURNING id INTO result;
 INSERT INTO customer_subscription_credits(establishment_id,cycle_id,service_id,contracted) SELECT s.establishment_id,result,i.service_id,i.quantity FROM customer_subscription_plan_items i WHERE i.plan_id=s.plan_id ON CONFLICT(cycle_id,service_id) DO NOTHING;
 UPDATE customer_service_subscriptions SET status='active',next_renewal_at=p_ends_at,updated_at=now() WHERE id=s.id; RETURN result; END $$;

-- Atomic, idempotent consumption. Credits are only consumed for a completed appointment or an open comanda.
CREATE OR REPLACE FUNCTION public.consume_service_benefit(p_client_id uuid,p_service_id uuid,p_benefit_type text,p_credit_id uuid,p_appointment_id uuid DEFAULT NULL,p_comanda_id uuid DEFAULT NULL,p_professional_id uuid DEFAULT NULL,p_reference_value numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE est uuid; result uuid; remaining int;
BEGIN SELECT establishment_id INTO est FROM clients WHERE id=p_client_id; IF est IS NULL OR NOT is_establishment_member(est,auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF p_appointment_id IS NULL AND p_comanda_id IS NULL THEN RAISE EXCEPTION 'Atendimento ou comanda obrigatório'; END IF;
 IF p_appointment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM appointments WHERE id=p_appointment_id AND establishment_id=est AND client_id=p_client_id AND status NOT IN ('scheduled','canceled')) THEN RAISE EXCEPTION 'Atendimento ainda não realizado ou cancelado'; END IF;
 IF p_benefit_type='package' THEN
   SELECT c.contracted-c.used INTO remaining FROM customer_package_credits c JOIN customer_packages x ON x.id=c.customer_package_id WHERE c.id=p_credit_id AND c.service_id=p_service_id AND x.client_id=p_client_id AND x.establishment_id=est AND x.status='active' AND now() BETWEEN x.starts_at AND x.expires_at FOR UPDATE OF c;
   IF coalesce(remaining,0)<1 THEN RAISE EXCEPTION 'Crédito de pacote indisponível'; END IF; UPDATE customer_package_credits SET used=used+1 WHERE id=p_credit_id;
   INSERT INTO service_benefit_consumptions(establishment_id,client_id,service_id,benefit_type,package_credit_id,appointment_id,comanda_id,professional_id,reference_value,consumed_by) VALUES(est,p_client_id,p_service_id,'package',p_credit_id,p_appointment_id,p_comanda_id,p_professional_id,p_reference_value,auth.uid()) RETURNING id INTO result;
 ELSIF p_benefit_type='subscription' THEN
   SELECT c.contracted-c.used INTO remaining FROM customer_subscription_credits c JOIN customer_subscription_cycles y ON y.id=c.cycle_id JOIN customer_service_subscriptions s ON s.id=y.subscription_id WHERE c.id=p_credit_id AND c.service_id=p_service_id AND s.client_id=p_client_id AND s.establishment_id=est AND s.status='active' AND y.status='active' AND now() BETWEEN y.starts_at AND y.ends_at FOR UPDATE OF c;
   IF coalesce(remaining,0)<1 THEN RAISE EXCEPTION 'Crédito de assinatura indisponível'; END IF; UPDATE customer_subscription_credits SET used=used+1 WHERE id=p_credit_id;
   INSERT INTO service_benefit_consumptions(establishment_id,client_id,service_id,benefit_type,subscription_credit_id,appointment_id,comanda_id,professional_id,reference_value,consumed_by) VALUES(est,p_client_id,p_service_id,'subscription',p_credit_id,p_appointment_id,p_comanda_id,p_professional_id,p_reference_value,auth.uid()) RETURNING id INTO result;
 ELSE RAISE EXCEPTION 'Tipo de benefício inválido'; END IF;
 IF p_comanda_id IS NOT NULL THEN
   UPDATE comanda_items SET reference_unit_price=coalesce(reference_unit_price,unit_price), unit_price=0, total=0,
     commission_amount=0, payment_source=p_benefit_type, benefit_consumption_id=result
   WHERE comanda_id=p_comanda_id AND service_id=p_service_id AND establishment_id=est AND benefit_consumption_id IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'Item da comanda não encontrado ou benefício já aplicado'; END IF;
   UPDATE comandas SET subtotal=(SELECT coalesce(sum(total),0) FROM comanda_items WHERE comanda_id=p_comanda_id),
     total=greatest(0,(SELECT coalesce(sum(total),0) FROM comanda_items WHERE comanda_id=p_comanda_id)-coalesce(discount,0)),updated_at=now()
   WHERE id=p_comanda_id AND establishment_id=est;
 END IF;
 RETURN result;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Benefício já consumido para este serviço do atendimento'; END $$;

-- Tenant RLS: members read operational data; only owner/admin manage definitions and sales. Consumption only via RPC.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['service_packages','service_package_items','customer_packages','customer_package_credits','customer_subscription_plans','customer_subscription_plan_items','customer_service_subscriptions','customer_subscription_cycles','customer_subscription_credits','service_benefit_consumptions'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t); EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (is_establishment_member(establishment_id,auth.uid()) OR has_role(auth.uid(),''super_admin''))',t); END LOOP; END $$;
CREATE POLICY tenant_manage_packages ON public.service_packages FOR ALL TO authenticated USING(current_establishment_role() IN ('owner','admin') AND establishment_id=current_establishment_id()) WITH CHECK(current_establishment_role() IN ('owner','admin') AND establishment_id=current_establishment_id());
CREATE POLICY tenant_manage_package_items ON public.service_package_items FOR ALL TO authenticated USING(current_establishment_role() IN ('owner','admin') AND establishment_id=current_establishment_id()) WITH CHECK(current_establishment_role() IN ('owner','admin') AND establishment_id=current_establishment_id());
CREATE POLICY tenant_manage_plans ON public.customer_subscription_plans FOR ALL TO authenticated USING(current_establishment_role() IN ('owner','admin') AND establishment_id=current_establishment_id()) WITH CHECK(current_establishment_role() IN ('owner','admin') AND establishment_id=current_establishment_id());
CREATE POLICY tenant_manage_plan_items ON public.customer_subscription_plan_items FOR ALL TO authenticated USING(current_establishment_role() IN ('owner','admin') AND establishment_id=current_establishment_id()) WITH CHECK(current_establishment_role() IN ('owner','admin') AND establishment_id=current_establishment_id());
GRANT EXECUTE ON FUNCTION public.sell_service_package(uuid,uuid,numeric,timestamptz,uuid), public.open_customer_subscription_cycle(uuid,timestamptz,timestamptz,text), public.consume_service_benefit(uuid,uuid,text,uuid,uuid,uuid,uuid,numeric) TO authenticated;
