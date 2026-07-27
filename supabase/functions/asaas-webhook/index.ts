import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let logId: string | null = null;

  try {
    const expected = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
    const received = req.headers.get('asaas-access-token') ?? req.headers.get('asaas-token');
    if (expected && received !== expected) {
      return new Response(JSON.stringify({ error: 'Invalid webhook token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const event: string = payload.event;
    const payment = payload.payment ?? {};
    const subscriptionId: string | undefined = typeof payment.subscription === 'string'
      ? payment.subscription
      : payment.subscription?.id;
    const customerId: string | undefined = typeof payment.customer === 'string'
      ? payment.customer
      : payment.customer?.id;
    const paymentId: string | undefined = payment.id;

    // Log
    const { data: log, error: logError } = await admin.from('asaas_webhook_logs').insert({
      event,
      asaas_payment_id: paymentId ?? null,
      asaas_subscription_id: subscriptionId ?? null,
      payload,
    }).select('id').single();
    if (logError) throw logError;
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
        raw: payment,
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

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('asaas-webhook error', e);
    if (logId) {
      await admin.from('asaas_webhook_logs').update({
        processed: false,
        error: (e as Error).message,
      }).eq('id', logId);
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
