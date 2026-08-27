import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";

const MAX_BODY_BYTES = 16 * 1024;
const ALLOWED_ROLES = new Set(["admin", "employee"]);

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (!isAllowedBrowserOrigin(req)) return new Response(JSON.stringify({ error: "Origin não permitida" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return new Response(JSON.stringify({ error: "Payload muito grande" }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });

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
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    if (authErr || !callerId || claimsData?.claims?.role !== "authenticated") {
      console.error("auth error", authErr);
      throw new Error("Usuário não autenticado");
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) throw new Error("Payload muito grande");
    const body = JSON.parse(rawBody);
    const { establishment_id, membership_id, email, password, name, role } = body ?? {};

    if (!establishment_id || !membership_id) throw new Error("Dados obrigatórios ausentes");
    if (role !== undefined && !ALLOWED_ROLES.has(String(role))) throw new Error("Perfil inválido");
    if (name !== undefined && String(name).trim().length > 120) throw new Error("Dados inválidos");
    if (email !== undefined && String(email).length > 254) throw new Error("Dados inválidos");

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
    const normalizedEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : undefined;
    if (normalizedEmail) authUpdates.email = normalizedEmail;
    if (password && String(password).length > 0) {
      if (String(password).length < 6) throw new Error("Senha deve ter pelo menos 6 caracteres");
      authUpdates.password = String(password);
    }
    if (Object.keys(authUpdates).length > 0) {
      const { error: aErr } = await adminClient.auth.admin.updateUserById(membership.user_id, authUpdates);
      if (aErr) throw aErr;
    }

    const membershipUpdates: Record<string, unknown> = {};
    if (role && (role === "admin" || role === "employee")) membershipUpdates.role = role;
    if (normalizedEmail) membershipUpdates.email = normalizedEmail;

    if (Object.keys(membershipUpdates).length > 0) {
      const { error: rErr } = await adminClient
        .from("establishment_users")
        .update(membershipUpdates)
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
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Erro" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
