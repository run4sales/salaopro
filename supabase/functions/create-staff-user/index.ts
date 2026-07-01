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

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    if (authErr || !callerId || claimsData?.claims?.role !== "authenticated") {
      console.error("auth error", authErr);
      throw new Error("Usuário não autenticado");
    }

    const body = await req.json();
    const { establishment_id, email, password, name, role } = body ?? {};

    if (!establishment_id || !email || !password || !name || !role) throw new Error("Dados obrigatórios ausentes");
    if (String(password).length < 6) throw new Error("Senha deve ter pelo menos 6 caracteres");

    const { data: ownerProfile } = await adminClient.from("profiles").select("id").eq("id", establishment_id).eq("user_id", callerId).maybeSingle();
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
    if (!canManage) throw new Error("Sem permissão para gerenciar usuários deste estabelecimento");

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: createdUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: {
        full_name: String(name).trim(),
        is_staff: true,
        establishment_id,
        staff_role: role,
      },
    });

    if (createErr) {
      if (!createErr.message?.toLowerCase().includes("already")) throw createErr;
    }

    let userId = createdUser.user?.id;
    if (!userId) {
      const { data: list } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matched = list.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
      userId = matched?.id;
    }
    if (!userId) throw new Error("Não foi possível localizar usuário criado");

    const { data: professional, error: profErr } = await adminClient
      .from("professionals")
      .insert({ establishment_id, name: String(name).trim(), active: true })
      .select("id")
      .single();
    if (profErr) throw profErr;

    const { error: linkErr } = await adminClient
      .from("establishment_users")
      .upsert({ establishment_id, user_id: userId, role, professional_id: professional.id, active: true, email: normalizedEmail }, { onConflict: "establishment_id,user_id" });
    if (linkErr) throw linkErr;

    return new Response(JSON.stringify({ user_id: userId, professional_id: professional.id }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Erro" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
