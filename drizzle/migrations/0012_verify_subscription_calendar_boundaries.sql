DO $$
DECLARE d integer; state text;
BEGIN
 FOR d IN -3..3 LOOP
  state := public.subscription_calendar_state('active',null,'2026-01-01T00:00:00Z','2026-10-10T03:00:00Z',null,null,'PENDING','2026-10-10',('2026-10-10T15:00:00Z'::timestamptz + d * interval '1 day'));
  IF d < 3 AND state <> 'payment_pending' THEN RAISE EXCEPTION 'Unexpected access state on day %: %',d,state; END IF;
  IF d = 3 AND state <> 'blocked' THEN RAISE EXCEPTION 'Third overdue day must block'; END IF;
 END LOOP;
 IF public.subscription_calendar_state('trial','2026-10-11T15:00:00Z','2026-10-01T15:00:00Z',null,null,null,null,null,'2026-10-11T15:00:00Z') <> 'trial_expired' THEN RAISE EXCEPTION 'Trial must expire after ten days'; END IF;
 IF public.subscription_calendar_state('active',null,'2026-01-01T00:00:00Z','2026-11-10T03:00:00Z',null,null,'CONFIRMED','2026-10-10','2026-10-10T15:00:00Z') <> 'active_paid' THEN RAISE EXCEPTION 'Paid cycle must release access'; END IF;
END;
$$;