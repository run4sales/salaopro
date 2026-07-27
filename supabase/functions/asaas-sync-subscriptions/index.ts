import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { syncAsaasSubscription } from '../_shared/asaas-sync.ts';

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const started = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('ASAAS_API_KEY');
    if (!apiKey) throw new Error('ASAAS_API_KEY não configurada');
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({})) as {
      establishment_id?: string;
      limit?: number;
      mode?: 'manual' | 'audit';
    };

    let userId: string | null = null;
    const schedulerSecret = Deno.env.get('ASAAS_SYNC_SECRET');
    const receivedSecret = req.headers.get('x-asaas-sync-secret');
    const scheduled = Boolean(schedulerSecret && receivedSecret === schedulerSecret);
    if (!scheduled) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error } = await userClient.auth.getClaims(authHeader.slice(7));
      userId = claims?.claims?.sub as string | undefined ?? null;
      if (error || !userId) return json({ error: 'Unauthorized' }, 401);
      const { data: role } = await admin.from('user_roles').select('role')
        .eq('user_id', userId).eq('role', 'super_admin').maybeSingle();
      if (!role) return json({ error: 'Forbidden' }, 403);
    }

    const source = scheduled || body.mode === 'audit' ? 'audit' : 'manual';
    const limit = Math.min(Math.max(Number(body.limit ?? 500), 1), 2_000);
    let query = admin.from('subscriptions').select('establishment_id').order('updated_at').limit(limit);
    if (body.establishment_id) query = query.eq('establishment_id', body.establishment_id);
    const { data: subscriptions, error: queryError } = await query;
    if (queryError) throw queryError;
    const subscriptionRows = [...(subscriptions ?? [])];

    // A missing local row is itself an association failure. Manual sync can
    // repair it before looking up the Asaas customer by externalReference.
    if (body.establishment_id && subscriptionRows.length === 0) {
      const { data: profile, error: profileError } = await admin.from('profiles')
        .select('id, plan').eq('id', body.establishment_id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return json({ error: 'Estabelecimento não encontrado' }, 404);
      const { data: plan } = profile.plan && profile.plan !== 'trial'
        ? await admin.from('subscription_plans').select('id, monthly_price').eq('slug', profile.plan).maybeSingle()
        : { data: null };
      const { error: insertError } = await admin.from('subscriptions').insert({
        establishment_id: profile.id,
        plan_id: plan?.id ?? null,
        monthly_amount: Number(plan?.monthly_price ?? 0),
        status: 'trial',
      });
      if (insertError) throw insertError;
      subscriptionRows.push({ establishment_id: profile.id });
    }

    const results: Array<Record<string, unknown>> = [];
    let synced = 0;
    let corrected = 0;
    let failed = 0;
    for (const row of subscriptionRows) {
      const itemStarted = Date.now();
      try {
        const result = await syncAsaasSubscription(admin, apiKey, row.establishment_id, source);
        synced += 1;
        if (result.changed) corrected += 1;
        results.push(result);
      } catch (error) {
        failed += 1;
        const message = (error as Error).message;
        await admin.from('asaas_sync_logs').insert({
          source,
          establishment_id: row.establishment_id,
          error: message,
          duration_ms: Date.now() - itemStarted,
          details: { trace: [`Falha ao sincronizar ${row.establishment_id}`, message] },
        });
        results.push({ establishment_id: row.establishment_id, error: message });
      }
    }

    if (userId) {
      await admin.from('admin_actions_log').insert({
        admin_user_id: userId,
        action: body.establishment_id ? 'asaas_manual_sync' : 'asaas_audit_sync',
        target_establishment_id: body.establishment_id ?? null,
        details: { synced, corrected, failed, duration_ms: Date.now() - started },
      });
    }
    return json({
      ok: failed === 0,
      total: subscriptionRows.length,
      synced,
      corrected,
      failed,
      duration_ms: Date.now() - started,
      results,
    }, failed && !synced ? 502 : 200);
  } catch (error) {
    console.error('asaas-sync-subscriptions error', error);
    return json({ error: (error as Error).message, duration_ms: Date.now() - started }, 500);
  }
});
