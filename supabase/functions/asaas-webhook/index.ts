import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const MAX_BODY_BYTES = 256 * 1024;
const SUPPORTED_EVENTS = new Set([
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
  'PAYMENT_DELETED',
]);

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function tokensMatch(expected: string, received: string | null) {
  if (!received) return false;
  const encoder = new TextEncoder();
  const [expectedDigest, receivedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
  ]);
  const left = new Uint8Array(expectedDigest);
  const right = new Uint8Array(receivedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sanitizedPayment(payment: Record<string, unknown>) {
  return {
    id: payment.id ?? null,
    subscription: typeof payment.subscription === 'string' ? payment.subscription : null,
    status: payment.status ?? null,
    billingType: payment.billingType ?? null,
    dueDate: payment.dueDate ?? null,
    paymentDate: payment.paymentDate ?? null,
    value: payment.value ?? null,
    netValue: payment.netValue ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expected = Deno.env.get('ASAAS_WEBHOOK_TOKEN')?.trim();
  if (!expected) {
    console.error('asaas-webhook rejected request: ASAAS_WEBHOOK_TOKEN is not configured');
    return json({ error: 'Webhook unavailable' }, 503);
  }

  const received = req.headers.get('asaas-access-token') ?? req.headers.get('asaas-token');
  if (!(await tokensMatch(expected, received))) return json({ error: 'Unauthorized' }, 401);

  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let logId: string | null = null;

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'Payload too large' }, 413);
    }
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const event = typeof payload.event === 'string' ? payload.event : '';
    const payment = (payload.payment ?? {}) as Record<string, unknown>;
    const subscriptionId: string | undefined = typeof payment.subscription === 'string'
      ? payment.subscription
      : typeof payment.subscription === 'object' && payment.subscription !== null
        ? String((payment.subscription as Record<string, unknown>).id ?? '') || undefined
        : undefined;
    const customerId: string | undefined = typeof payment.customer === 'string'
      ? payment.customer
      : typeof payment.customer === 'object' && payment.customer !== null
        ? String((payment.customer as Record<string, unknown>).id ?? '') || undefined
        : undefined;
    const paymentId = typeof payment.id === 'string' ? payment.id : undefined;

    if (!SUPPORTED_EVENTS.has(event) || !paymentId || (!subscriptionId && !customerId)) {
      return json({ error: 'Invalid webhook payload' }, 400);
    }

    // Prefer the provider event id; the body digest is a deterministic fallback
    // that makes byte-identical retries idempotent without persisting the body.
    const providerEventId = typeof payload.id === 'string' && payload.id.trim()
      ? `asaas:${payload.id.trim()}`
      : `sha256:${await sha256Hex(rawBody)}`;
    const safePayload = { event, payment: sanitizedPayment(payment) };

    const { data: log, error: logError } = await admin.from('asaas_webhook_logs').upsert({
      provider_event_id: providerEventId,
      event,
      asaas_payment_id: paymentId ?? null,
      asaas_subscription_id: subscriptionId ?? null,
      payload: safePayload,
    }, { onConflict: 'provider_event_id', ignoreDuplicates: true }).select('id').maybeSingle();
    if (logError) throw logError;
    if (!log) return json({ ok: true, duplicate: true });
    logId = log.id;

    // Locate the local subscription. Some Asaas payment events omit the
    // subscription field, so the customer is a necessary fallback.
    let establishmentId: string | null = null;
    let localSubId: string | null = null;
    let localSub: { id: string; establishment_id: string; pending_plan_id: string | null } | null = null;
    if (subscriptionId) {
      const { data: sub, error } = await admin.from('subscriptions')
        .select('id, establishment_id, pending_plan_id')
        .eq('asaas_subscription_id', subscriptionId).maybeSingle();
      if (error) throw error;
      localSub = sub;
    }
    if (!localSub && customerId) {
      const { data: sub, error } = await admin.from('subscriptions')
        .select('id, establishment_id, pending_plan_id')
        .eq('asaas_customer_id', customerId).maybeSingle();
      if (error) throw error;
      localSub = sub;
    }
    if (localSub) {
      establishmentId = localSub.establishment_id;
      localSubId = localSub.id;
    }

    if (paymentId && !localSub) {
      throw new Error(
        `Local subscription not found (Asaas subscription: ${subscriptionId ?? 'missing'}, customer: ${customerId ?? 'missing'})`,
      );
    }

    if (localSub && paymentId) {
      // Upsert payment record
      const { error: paymentError } = await admin.from('subscription_payments').upsert({
        establishment_id: establishmentId,
        subscription_id: localSubId,
        asaas_payment_id: paymentId,
        asaas_subscription_id: subscriptionId,
        value: Number(payment.value ?? 0),
        net_value: payment.netValue ? Number(payment.netValue) : null,
        status: payment.status ?? event,
        billing_type: payment.billingType ?? null,
        due_date: payment.dueDate ?? null,
        payment_date: payment.paymentDate ? new Date(payment.paymentDate).toISOString() : null,
        invoice_url: payment.invoiceUrl ?? null,
        bank_slip_url: payment.bankSlipUrl ?? null,
        raw: sanitizedPayment(payment),
      }, { onConflict: 'asaas_payment_id' });
      if (paymentError) throw paymentError;

      // Update subscription state based on event
      const updates: Record<string, unknown> = {};
      switch (event) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED': {
          updates.status = 'active';
          updates.last_payment_at = new Date().toISOString();
          updates.canceled_at = null;
          const base = payment.dueDate
            ? new Date(`${payment.dueDate}T12:00:00.000Z`)
            : new Date();
          const billingDay = base.getUTCDate();
          base.setUTCDate(1);
          base.setUTCMonth(base.getUTCMonth() + 1);
          const lastDayOfBillingMonth = new Date(Date.UTC(
            base.getUTCFullYear(),
            base.getUTCMonth() + 1,
            0,
          )).getUTCDate();
          base.setUTCDate(Math.min(billingDay, lastDayOfBillingMonth));
          updates.next_billing_at = base.toISOString();
          // Payment-related restrictions are removed. A manual admin block is
          // intentionally preserved and can only be removed by an admin.
          updates.grace_started_at = null;
          updates.grace_ends_at = null;
          updates.grace_cycle_key = null;

          // Apply pending plan change (downgrade scheduled for next cycle)
          if (localSub.pending_plan_id) {
            const { data: pp, error: planError } = await admin.from('subscription_plans')
              .select('id, monthly_price').eq('id', localSub.pending_plan_id).maybeSingle();
            if (planError) throw planError;
            if (pp) {
              updates.plan_id = pp.id;
              updates.monthly_amount = pp.monthly_price;
              updates.pending_plan_id = null;
              updates.pending_plan_effective_at = null;
            }
          }
          break;
        }
        case 'PAYMENT_OVERDUE':
          updates.status = 'past_due';
          break;
        case 'PAYMENT_REFUNDED':
        case 'PAYMENT_DELETED':
          updates.status = 'canceled';
          break;
      }
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await admin.from('subscriptions').update(updates)
          .eq('id', localSubId);
        if (updateError) throw updateError;
      }

    }

    const { error: processedError } = await admin.from('asaas_webhook_logs')
      .update({ processed: true, error: null }).eq('id', logId);
    if (processedError) throw processedError;

    return json({ ok: true });
  } catch (e) {
    console.error('asaas-webhook error', e);
    if (logId) {
      // Release the idempotency key after a failed attempt so a provider retry
      // can process it again. Operational failures are emitted without payload.
      await admin.from('asaas_webhook_logs').delete().eq('id', logId).eq('processed', false);
    }
    return json({ error: 'Webhook processing failed' }, 500);
  }
});
