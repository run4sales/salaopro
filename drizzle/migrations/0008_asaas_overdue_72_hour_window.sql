DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = 'get_subscription_state';
  IF definition IS NULL THEN RAISE EXCEPTION 'Canonical subscription state function missing'; END IF;
  definition := replace(definition,
    E'IF s.status = ''past_due'' THEN\n   IF has_active_grace THEN RETURN ''grace_active''; END IF;\n   RETURN ''overdue'';\n END IF;',
    E'IF s.status = ''past_due'' THEN\n   IF has_active_grace THEN RETURN ''grace_active''; END IF;\n   IF s.next_billing_at IS NULL THEN RETURN ''overdue''; END IF;\n   days_overdue := EXTRACT(EPOCH FROM (now() - s.next_billing_at)) / 86400;\n   IF days_overdue < 3 THEN RETURN ''payment_pending''; END IF;\n   RETURN ''blocked'';\n END IF;');
  EXECUTE definition;
END;
$$;