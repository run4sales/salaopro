import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ASAAS_BASE = 'https://api.asaas.com/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('ASAAS_API_KEY');
    if (!apiKey) throw new Error('ASAAS_API_KEY not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as { new_plan_id: string };
    if (!body.new_plan_id) {
      return new Response(JSON.stringify({ error: 'new_plan_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: profile } = await admin
      .from('profiles').select('id').eq('user_id', claims.claims.sub).maybeSingle();
    if (!profile) throw new Error('Perfil não encontrado');

    const { data: sub } = await admin
      .from('subscriptions').select('*').eq('establishment_id', profile.id).maybeSingle();
    if (!sub) throw new Error('Assinatura não encontrada');

    const { data: newPlan } = await admin
      .from('subscription_plans').select('*').eq('id', body.new_plan_id).maybeSingle();
    if (!newPlan) throw new Error('Plano novo inválido');

    const currentPrice = Number(sub.monthly_amount ?? 0);
    const newPrice = Number(newPlan.monthly_price);
    const isUpgrade = newPrice >= currentPrice;

    // DOWNGRADE — agenda para o próximo ciclo
    if (!isUpgrade) {
      await admin.from('subscriptions').update({
        pending_plan_id: newPlan.id,
        pending_plan_effective_at: sub.next_billing_at,
      }).eq('establishment_id', profile.id);

      return new Response(JSON.stringify({
        ok: true,
        scheduled: true,
        effective_at: sub.next_billing_at,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // UPGRADE — cancela atual e cria nova imediatamente
    const headers = {
      'Content-Type': 'application/json',
      access_token: apiKey,
      'User-Agent': 'BeautyCore/1.0',
    };

    if (!sub.asaas_customer_id) {
      throw new Error('Assinatura ainda não foi criada no Asaas. Conclua o checkout inicial.');
    }

    if (sub.asaas_subscription_id) {
      await fetch(`${ASAAS_BASE}/subscriptions/${sub.asaas_subscription_id}`, {
        method: 'DELETE', headers,
      }).catch(() => {});
    }

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 1);

    const subRes = await fetch(`${ASAAS_BASE}/subscriptions`, {
      method: 'POST', headers,
      body: JSON.stringify({
        customer: sub.asaas_customer_id,
        billingType: sub.billing_type ?? 'BOLETO',
        value: newPrice,
        nextDueDate: nextDue.toISOString().slice(0, 10),
        cycle: 'MONTHLY',
        description: `Beauty Core — Plano ${newPlan.name}`,
        externalReference: profile.id,
      }),
    });
    const subJson = await subRes.json();
    if (!subRes.ok) throw new Error(`Asaas subscription: ${JSON.stringify(subJson)}`);

    const paysRes = await fetch(`${ASAAS_BASE}/subscriptions/${subJson.id}/payments?limit=1`, { headers });
    const paysJson = await paysRes.json();
    const firstPayment = paysJson?.data?.[0];
    const paymentLink = firstPayment?.invoiceUrl ?? null;

    await admin.from('subscriptions').update({
      plan_id: newPlan.id,
      monthly_amount: newPlan.monthly_price,
      asaas_subscription_id: subJson.id,
      payment_link: paymentLink,
      pending_plan_id: null,
      pending_plan_effective_at: null,
      next_billing_at: subJson.nextDueDate ? new Date(subJson.nextDueDate).toISOString() : null,
    }).eq('establishment_id', profile.id);

    return new Response(JSON.stringify({
      ok: true,
      scheduled: false,
      subscription_id: subJson.id,
      payment_link: paymentLink,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('asaas-change-plan error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
