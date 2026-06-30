import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization ausente");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authErr } = await adminClient.auth.getUser(token);
    const callerId = authData?.user?.id;
    if (authErr || !callerId) {
      console.error("auth error", authErr);
      throw new Error("Usuário não autenticado");
    }

    const body = await req.json();
    const { establishment_id, membership_id, email, password, name, role } = body ?? {};

    if (!establishment_id || !membership_id) throw new Error("Dados obrigatórios ausentes");

    const { data: ownerProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", establishment_id)
      .eq("user_id", callerId)
      .maybeSingle();
    let canManage = !!ownerProfile;
    if (!canManage) {
      const { data: adminMembership } = await adminClient
        .from("establishment_users")
        .select("id")
        .eq("establishment_id", establishment_id)
        .eq("user_id", callerId)
        .eq("role", "admin")
        .eq("active", true)
        .maybeSingle();
      canManage = !!adminMembership;
    }
    if (!canManage) throw new Error("Sem permissão");

    const { data: membership, error: mErr } = await adminClient
      .from("establishment_users")
      .select("id, user_id, professional_id, establishment_id")
      .eq("id", membership_id)
      .eq("establishment_id", establishment_id)
      .maybeSingle();
    if (mErr || !membership) throw new Error("Usuário não encontrado");

    const authUpdates: Record<string, unknown> = {};
    if (email && String(email).trim()) authUpdates.email = String(email).trim().toLowerCase();
    if (password && String(password).length > 0) {
      if (String(password).length < 6) throw new Error("Senha deve ter pelo menos 6 caracteres");
      authUpdates.password = String(password);
    }
    if (Object.keys(authUpdates).length > 0) {
      const { error: aErr } = await adminClient.auth.admin.updateUserById(membership.user_id, authUpdates);
      if (aErr) throw aErr;
    }

    if (role && (role === "admin" || role === "employee")) {
      const { error: rErr } = await adminClient
        .from("establishment_users")
        .update({ role })
        .eq("id", membership_id);
      if (rErr) throw rErr;
    }

    if (name && String(name).trim() && membership.professional_id) {
      const { error: pErr } = await adminClient
        .from("professionals")
        .update({ name: String(name).trim() })
        .eq("id", membership.professional_id);
      if (pErr) throw pErr;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Erro" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
