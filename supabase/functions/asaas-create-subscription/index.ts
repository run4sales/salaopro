import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ASAAS_BASE = 'https://api.asaas.com/v3';

interface Body {
  plan_id: string;
  billing_type: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  cpf_cnpj: string;
  name: string;
  email: string;
  phone?: string;
  postal_code?: string;
  address_number?: string;
}

function onlyDigits(s: string) { return (s || '').replace(/\D/g, ''); }

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

    const body = (await req.json()) as Body;
    if (!body.plan_id || !body.billing_type || !body.cpf_cnpj || !body.name || !body.email) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin client (bypass RLS for billing writes)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: profile, error: profileError } = await admin
      .from('profiles').select('id, business_name')
      .eq('user_id', claims.claims.sub).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw new Error('Profile não encontrado');

    const { data: plan, error: planError } = await admin
      .from('subscription_plans').select('*').eq('id', body.plan_id).maybeSingle();
    if (planError) throw planError;
    if (!plan) throw new Error('Plano inválido');

    const { data: sub, error: subscriptionError } = await admin
      .from('subscriptions').select('*').eq('establishment_id', profile.id).maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!sub) throw new Error(`Assinatura local não encontrada para ${profile.id}`);

    const headers = {
      'Content-Type': 'application/json',
      access_token: apiKey,
      'User-Agent': 'BeautyCore/1.0',
    };

    // 1) Customer (create or reuse)
    let customerId = sub?.asaas_customer_id as string | undefined;
    if (customerId) {
      const existingResponse = await fetch(`${ASAAS_BASE}/customers/${customerId}`, { headers });
      const existingCustomer = await existingResponse.json().catch(() => ({}));
      if (!existingResponse.ok || (existingCustomer.externalReference && existingCustomer.externalReference !== profile.id)) {
        console.warn('[asaas-create] Customer armazenado inválido para o estabelecimento', {
          establishmentId: profile.id,
          customerId,
          externalReference: existingCustomer.externalReference,
        });
        customerId = undefined;
      }
    }
    if (!customerId) {
      const findResponse = await fetch(
        `${ASAAS_BASE}/customers?externalReference=${encodeURIComponent(profile.id)}&limit=100`,
        { headers },
      );
      const found = await findResponse.json().catch(() => ({}));
      if (!findResponse.ok) throw new Error(`Asaas customer lookup: ${JSON.stringify(found)}`);
      customerId = found.data?.find((item: { externalReference?: string }) =>
        item.externalReference === profile.id
      )?.id;
    }
    if (!customerId) {
      const custRes = await fetch(`${ASAAS_BASE}/customers`, {
        method: 'POST', headers,
        body: JSON.stringify({
          name: body.name,
          cpfCnpj: onlyDigits(body.cpf_cnpj),
          email: body.email,
          mobilePhone: body.phone ? onlyDigits(body.phone) : undefined,
          postalCode: body.postal_code ? onlyDigits(body.postal_code) : undefined,
          addressNumber: body.address_number,
          externalReference: profile.id,
        }),
      });
      const custJson = await custRes.json();
      if (!custRes.ok) throw new Error(`Asaas customer: ${JSON.stringify(custJson)}`);
      customerId = custJson.id;
    }
    console.info('[asaas-create] Customer associado', { establishmentId: profile.id, customerId });

    // 2) Cancel previous subscription if exists
    if (sub?.asaas_subscription_id) {
      const cancelResponse = await fetch(`${ASAAS_BASE}/subscriptions/${sub.asaas_subscription_id}`, {
        method: 'DELETE', headers,
      });
      if (!cancelResponse.ok && cancelResponse.status !== 404) {
        throw new Error(`Falha ao cancelar assinatura anterior: HTTP ${cancelResponse.status}`);
      }
    }

    // 3) Create subscription (MONTHLY)
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 1);
    const subRes = await fetch(`${ASAAS_BASE}/subscriptions`, {
      method: 'POST', headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: body.billing_type,
        value: Number(plan.monthly_price),
        nextDueDate: nextDue.toISOString().slice(0, 10),
        cycle: 'MONTHLY',
        description: `Beauty Core — Plano ${plan.name}`,
        externalReference: profile.id,
      }),
    });
    const subJson = await subRes.json();
    if (!subRes.ok) throw new Error(`Asaas subscription: ${JSON.stringify(subJson)}`);
    if (subJson.externalReference !== profile.id) {
      throw new Error(`Asaas retornou externalReference divergente para subscription ${subJson.id}`);
    }
    console.info('[asaas-create] Subscription criada', {
      establishmentId: profile.id, customerId, subscriptionId: subJson.id,
    });

    // 4) Get first payment link
    const paysRes = await fetch(
      `${ASAAS_BASE}/subscriptions/${subJson.id}/payments?limit=1`,
      { headers },
    );
    const paysJson = await paysRes.json();
    if (!paysRes.ok) throw new Error(`Asaas payments: ${JSON.stringify(paysJson)}`);
    const firstPayment = paysJson?.data?.[0];
    const paymentLink = firstPayment?.invoiceUrl ?? null;

    // 5) Update local subscription
    const { data: updated, error: updateError } = await admin.from('subscriptions').update({
      plan_id: plan.id,
      monthly_amount: plan.monthly_price,
      asaas_customer_id: customerId,
      asaas_subscription_id: subJson.id,
      billing_type: body.billing_type,
      payment_link: paymentLink,
      billing_cpf_cnpj: onlyDigits(body.cpf_cnpj),
      billing_name: body.name,
      billing_email: body.email,
      next_billing_at: subJson.nextDueDate ? new Date(subJson.nextDueDate).toISOString() : null,
    }).eq('establishment_id', profile.id).select('id').single();
    if (updateError || !updated) throw updateError ?? new Error('Assinatura local não atualizada');
    console.info('[asaas-create] Associação persistida', {
      establishmentId: profile.id, customerId, subscriptionId: subJson.id,
    });

    return new Response(JSON.stringify({
      ok: true,
      subscription_id: subJson.id,
      customer_id: customerId,
      payment_link: paymentLink,
      next_due_date: subJson.nextDueDate,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('asaas-create-subscription error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
