DROP TABLE public.client_benefit_uses;
DROP TABLE public.client_benefits;
REVOKE ALL ON FUNCTION public.sell_service_package(uuid,uuid,numeric,timestamptz,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_customer_subscription_cycle(uuid,timestamptz,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_service_benefit(uuid,uuid,text,uuid,uuid,uuid,uuid,numeric) FROM PUBLIC, anon;