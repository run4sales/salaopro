ALTER TABLE public.cash_flow_entries DROP CONSTRAINT cash_flow_entries_source_check;
ALTER TABLE public.cash_flow_entries ADD CONSTRAINT cash_flow_entries_source_check
  CHECK (source = ANY (ARRAY['sale'::text, 'sale_fee'::text, 'expense'::text, 'manual'::text, 'appointment_deposit'::text]));