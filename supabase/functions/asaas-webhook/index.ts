import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

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
    const subscriptionId: string | undefined = payment.subscription;
    const paymentId: string | undefined = payment.id;

    // Log
    const { data: log } = await admin.from('asaas_webhook_logs').insert({
      event,
      asaas_payment_id: paymentId ?? null,
      asaas_subscription_id: subscriptionId ?? null,
      payload,
    }).select('id').single();

    // Locate establishment
    let establishmentId: string | null = null;
    let localSubId: string | null = null;
    if (subscriptionId) {
      const { data: sub } = await admin.from('subscriptions')
        .select('id, establishment_id')
        .eq('asaas_subscription_id', subscriptionId).maybeSingle();
      if (sub) {
        establishmentId = sub.establishment_id;
        localSubId = sub.id;
      }
    }

    if (establishmentId && paymentId) {
      // Upsert payment record
      await admin.from('subscription_payments').upsert({
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

      // Update subscription state based on event
      const updates: Record<string, unknown> = {};
      const updates: Record<string, unknown> = {};
      switch (event) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED': {
          updates.status = 'active';
          updates.last_payment_at = new Date().toISOString();
          const base = payment.dueDate ? new Date(payment.dueDate) : new Date();
          base.setDate(base.getDate() + 30);
          updates.next_billing_at = base.toISOString();

          // Apply pending plan change (downgrade scheduled for next cycle)
          const { data: fullSub } = await admin.from('subscriptions')
            .select('pending_plan_id').eq('establishment_id', establishmentId).maybeSingle();
          if (fullSub?.pending_plan_id) {
            const { data: pp } = await admin.from('subscription_plans')
              .select('id, monthly_price').eq('id', fullSub.pending_plan_id).maybeSingle();
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
        await admin.from('subscriptions').update(updates)
          .eq('establishment_id', establishmentId);
      }

    }

    if (log?.id) {
      await admin.from('asaas_webhook_logs').update({ processed: true }).eq('id', log.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('asaas-webhook error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
