import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validate caller is super_admin
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'super_admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { establishment_id } = await req.json();
    if (!establishment_id) {
      return new Response(JSON.stringify({ error: 'establishment_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: sub } = await admin.from('subscriptions')
      .select('id, asaas_subscription_id').eq('establishment_id', establishment_id).maybeSingle();

    let asaasResult: unknown = null;
    if (sub?.asaas_subscription_id) {
      const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!;
      const ASAAS_BASE = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api.asaas.com/v3';
      const r = await fetch(`${ASAAS_BASE}/subscriptions/${sub.asaas_subscription_id}`, {
        method: 'DELETE',
        headers: { access_token: ASAAS_API_KEY, 'Content-Type': 'application/json' },
      });
      asaasResult = await r.json().catch(() => ({ ok: r.ok }));
    }

    return new Response(JSON.stringify({ ok: true, asaas: asaasResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('asaas-cancel-subscription error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
