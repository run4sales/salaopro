/* global Deno */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { syncAgendorSignupLead, type SignupLeadBody } from '../_shared/agendor.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('AGENDOR_API_KEY');
    if (!apiKey) throw new Error('AGENDOR_API_KEY não configurada');

    const body = (await req.json()) as SignupLeadBody;
    const result = await syncAgendorSignupLead(body, apiKey);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('agendor-create-signup-lead error', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
