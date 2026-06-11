/* global Deno */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { syncAgendorSignupLead } from '../_shared/agendor.ts';

type SyncRequestBody = {
  force?: boolean;
  limit?: number;
  establishment_ids?: string[];
};

type ProfileRow = {
  id: string;
  business_name: string;
  document: string | null;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  cep: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  business_type: string | null;
  plan?: string | null;
  selected_plan_slug?: string | null;
  agendor_deal_id?: number | null;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function assertSuperAdmin(req: Request, supabaseUrl: string, anonKey: string, serviceKey: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false as const, response: jsonResponse({ error: 'Unauthorized' }, 401) };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error: authError } = await userClient.auth.getClaims(token);
  const userId = claims?.claims?.sub as string | undefined;

  if (authError || !userId) {
    return { ok: false as const, response: jsonResponse({ error: 'Unauthorized' }, 401) };
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: role } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .maybeSingle();

  if (!role) {
    return { ok: false as const, response: jsonResponse({ error: 'Forbidden' }, 403) };
  }

  return { ok: true as const, adminClient, userId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const apiKey = Deno.env.get('AGENDOR_API_KEY');
    if (!apiKey) throw new Error('AGENDOR_API_KEY não configurada');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new Error('Variáveis do Supabase não configuradas');
    }

    const auth = await assertSuperAdmin(req, supabaseUrl, anonKey, serviceKey);
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as SyncRequestBody;
    const limit = Math.min(Math.max(Number(body.limit ?? 5000), 1), 10000);

    let query = auth.adminClient
      .from('profiles')
      .select('id, business_name, document, owner_name, email, phone, cep, street, neighborhood, city, business_type, plan, selected_plan_slug, agendor_deal_id')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (body.establishment_ids?.length) {
      query = query.in('id', body.establishment_ids);
    }

    if (!body.force) {
      query = query.is('agendor_deal_id', null);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;

    const results: Array<Record<string, unknown>> = [];
    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      if (profile.agendor_deal_id && !body.force) {
        skipped += 1;
        results.push({ establishment_id: profile.id, status: 'skipped', reason: 'already_synced' });
        continue;
      }

      try {
        const syncResult = await syncAgendorSignupLead({
          business_name: profile.business_name,
          document: profile.document ?? undefined,
          owner_name: profile.owner_name ?? undefined,
          email: profile.email ?? undefined,
          phone: profile.phone ?? undefined,
          cep: profile.cep ?? undefined,
          street: profile.street ?? undefined,
          neighborhood: profile.neighborhood ?? undefined,
          city: profile.city ?? undefined,
          business_type: profile.business_type ?? undefined,
          selected_plan: profile.selected_plan_slug ?? profile.plan ?? undefined,
        }, apiKey);

        const { error: updateError } = await auth.adminClient
          .from('profiles')
          .update({
            agendor_organization_id: syncResult.organization_id,
            agendor_deal_id: syncResult.deal_id,
            agendor_synced_at: new Date().toISOString(),
            agendor_sync_error: null,
          })
          .eq('id', profile.id);

        if (updateError) throw updateError;

        synced += 1;
        results.push({ establishment_id: profile.id, status: 'synced', ...syncResult });
      } catch (profileError) {
        failed += 1;
        const message = (profileError as Error).message;
        await auth.adminClient
          .from('profiles')
          .update({ agendor_sync_error: message })
          .eq('id', profile.id);
        results.push({ establishment_id: profile.id, status: 'failed', error: message });
      }
    }

    await auth.adminClient.from('admin_actions_log').insert({
      admin_user_id: auth.userId,
      action: 'agendor_sync_existing_companies',
      details: { total: profiles?.length ?? 0, synced, failed, skipped, force: Boolean(body.force) },
    });

    return jsonResponse({
      ok: failed === 0,
      total: profiles?.length ?? 0,
      synced,
      failed,
      skipped,
      results,
    }, failed === 0 ? 200 : 207);
  } catch (error) {
    console.error('agendor-sync-existing-companies error', error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
