
-- Allow staff members to operate on their establishment's data
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'appointments','clients','comandas','comanda_items',
    'sales','sale_professionals','professionals','services',
    'service_professionals','card_machines','card_machine_fees',
    'cash_flow_entries','expenses','goals','settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff can access establishment data" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "Staff can access establishment data"
      ON public.%I
      FOR ALL
      TO authenticated
      USING (public.is_establishment_member(establishment_id, auth.uid()))
      WITH CHECK (public.is_establishment_member(establishment_id, auth.uid()))
    $p$, t);
  END LOOP;
END $$;
