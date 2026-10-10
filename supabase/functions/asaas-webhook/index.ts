import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { PAYMENT_EVENTS } from '../_shared/asaas-client.ts';
import { syncAsaasSubscription } from '../_shared/asaas-sync.ts';

const MAX_BODY_BYTES = 256 * 1024;
const SUPPORTED_EVENTS = new Set(PAYMENT_EVENTS);

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

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
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
    const payload = JSON.parse(rawBody);
    if (!payload || typeof payload !== 'object') return json({ error: 'Invalid webhook payload' }, 400);
    const event: string = payload.event;
    const payment = payload.payment ?? {};
    const subscriptionId: string | undefined = typeof payment.subscription === 'string'
      ? payment.subscription
      : payment.subscription?.id;
    const customerId: string | undefined = typeof payment.customer === 'string'
      ? payment.customer
      : payment.customer?.id;
    const paymentId: string | undefined = payment.id;

    if (!SUPPORTED_EVENTS.has(event) || !paymentId || (!subscriptionId && !customerId)) {
      return json({ error: 'Invalid webhook payload' }, 400);
    }

    const providerEventId = typeof payload.id === 'string' && payload.id.trim()
      ? payload.id.trim()
      : await sha256(rawBody);

    // Log
    const { data: log, error: logError } = await admin.from('asaas_webhook_logs').insert({
      event,
      asaas_payment_id: paymentId ?? null,
      asaas_subscription_id: subscriptionId ?? null,
      provider_event_id: providerEventId,
      payload: { event, id: providerEventId, payment: { id: paymentId, subscription: subscriptionId, customer: customerId, status: payment.status, dueDate: payment.dueDate } },
    }).select('id').single();
    if (logError?.code === '23505') {
      const { data: existing, error: existingError } = await admin.from('asaas_webhook_logs')
        .select('processed').eq('provider_event_id', providerEventId).single();
      if (existingError) throw existingError;
      if (existing.processed) return json({ ok: true, duplicate: true });
    } else if (logError) throw logError;
    const { data: claimed, error: claimError } = await admin.rpc('claim_asaas_webhook', { p_event_id: providerEventId });
    if (claimError) throw claimError;
    if (!claimed) return json({ error: 'Event processing in progress; retry later' }, 503);
    logId = claimed;

    // Locate the local subscription. Some Asaas payment events omit the
    // subscription field, so the customer is a necessary fallback.
    let establishmentId: string | null = null;
    let localSubId: string | null = null;
    let localSub: { id: string; establishment_id: string; pending_plan_id: string | null; manual_blocked_at: string | null } | null = null;
    let customerServiceSub: { id: string; establishment_id: string } | null = null;
    if (subscriptionId) {
      const { data: sub, error } = await admin.from('subscriptions')
        .select('id, establishment_id, pending_plan_id, manual_blocked_at')
        .eq('asaas_subscription_id', subscriptionId).maybeSingle();
      if (error) throw error;
      localSub = sub;
    }
    if (!localSub && customerId) {
      const { data: sub, error } = await admin.from('subscriptions')
        .select('id, establishment_id, pending_plan_id, manual_blocked_at')
        .eq('asaas_customer_id', customerId).maybeSingle();
      if (error) throw error;
      localSub = sub;
    }
    if (localSub) {
      establishmentId = localSub.establishment_id;
      localSubId = localSub.id;
    }

    // Customer service plans share the established Asaas webhook and secrets;
    // they intentionally do not create a second billing integration.
    if (!localSub && subscriptionId) {
      const { data, error } = await admin.from('customer_service_subscriptions')
        .select('id, establishment_id').eq('asaas_subscription_id', subscriptionId).maybeSingle();
      if (error) throw error;
      customerServiceSub = data;
    }

    if (customerServiceSub) {
      if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
        const startsAt = payment.dueDate ? new Date(`${payment.dueDate}T00:00:00.000Z`) : new Date();
        const endsAt = new Date(startsAt);
        endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
        const { error } = await admin.rpc('open_customer_subscription_cycle', {
          p_subscription_id: customerServiceSub.id, p_starts_at: startsAt.toISOString(),
          p_ends_at: endsAt.toISOString(), p_asaas_payment_id: paymentId,
        });
        if (error) throw error;
      } else if (event === 'PAYMENT_OVERDUE') {
        const { error } = await admin.from('customer_service_subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('id', customerServiceSub.id);
        if (error) throw error;
      } else if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_DELETED') {
        const { error } = await admin.from('customer_service_subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', customerServiceSub.id);
        if (error) throw error;
      }
    }

    if (paymentId && !localSub && !customerServiceSub) {
      throw new Error(
        `Local subscription not found (Asaas subscription: ${subscriptionId ?? 'missing'}, customer: ${customerId ?? 'missing'})`,
      );
    }

    if (localSub && paymentId) {
      const apiKey = Deno.env.get('ASAAS_API_KEY');
      if (!apiKey) throw new Error('ASAAS_API_KEY não configurada');
      // Notifications can arrive late: read authoritative invoices instead of
      // trusting the delivery order or applying a stale status from the payload.
      await syncAsaasSubscription(admin, apiKey, localSub.establishment_id, 'webhook');
    }

    const { error: processedError } = await admin.from('asaas_webhook_logs')
      .update({ processed: true, error: null, processing_started_at: null }).eq('id', logId);
    if (processedError) throw processedError;

    return json({ ok: true });
  } catch (e) {
    console.error('asaas-webhook error', e);
    if (logId) {
      await admin.from('asaas_webhook_logs').update({
        processed: false,
        processing_started_at: null,
        error: (e as Error).message,
      }).eq('id', logId);
    }
    return json({ error: 'Webhook processing failed' }, 500);
  }
});
