import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";

const MAX_BODY_BYTES = 16 * 1024;
const ALLOWED_ROLES = new Set(["admin", "employee"]);

class RequestError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (!isAllowedBrowserOrigin(req)) return new Response(JSON.stringify({ error: "Origin não permitida" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return new Response(JSON.stringify({ error: "Payload muito grande" }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new RequestError("UNAUTHENTICATED", "Sessão inválida. Entre novamente.", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authErr } = await userClient.auth.getUser(token);
    const callerId = authData.user?.id;
    if (authErr || !callerId) {
      console.error("auth error", authErr);
      throw new RequestError("UNAUTHENTICATED", "Sessão inválida. Entre novamente.", 401);
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) throw new Error("Payload muito grande");
    const body = JSON.parse(rawBody);
    const { establishment_id, email, password, name, role, service_ids = [] } = body ?? {};

    if (!establishment_id || !email || !password || !name || !role) throw new RequestError("INVALID_INPUT", "Preencha todos os campos obrigatórios.");
    if (!ALLOWED_ROLES.has(String(role))) throw new RequestError("INVALID_ROLE", "Perfil inválido.");
    if (String(password).length < 6) throw new RequestError("WEAK_PASSWORD", "A senha deve ter pelo menos 6 caracteres.");
    if (String(name).trim().length > 120 || String(email).length > 254) throw new RequestError("INVALID_INPUT", "Dados inválidos.");
    if (!Array.isArray(service_ids) || service_ids.length > 200 || service_ids.some((id) => typeof id !== "string")) throw new RequestError("INVALID_INPUT", "Serviços inválidos.");

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
    if (!canManage) throw new RequestError("FORBIDDEN", "Você não tem permissão para gerenciar usuários desta loja.", 403);

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
      const duplicate = /already|registered|exists/i.test(createErr.message ?? "");
      throw new RequestError(duplicate ? "EMAIL_EXISTS" : "AUTH_CREATE_FAILED", duplicate ? "Este e-mail já está cadastrado." : "Não foi possível criar o acesso do funcionário.", duplicate ? 409 : 502);
    }
    const userId = createdUser.user?.id;
    if (!userId) throw new RequestError("AUTH_CREATE_FAILED", "Não foi possível criar o acesso do funcionário.", 502);

    const { data: professional, error: profErr } = await adminClient
      .from("professionals")
      .insert({ establishment_id, name: String(name).trim(), active: true })
      .select("id")
      .single();
    if (profErr) {
      await adminClient.auth.admin.deleteUser(userId);
      console.error("professional creation failed", profErr);
      throw new RequestError("PROFILE_CREATE_FAILED", "O acesso não foi criado porque o perfil profissional não pôde ser salvo.", 500);
    }

    const { error: linkErr } = await adminClient
      .from("establishment_users")
      .upsert({ establishment_id, user_id: userId, role, professional_id: professional.id, active: true, email: normalizedEmail }, { onConflict: "establishment_id,user_id" });
    if (linkErr) {
      await adminClient.from("professionals").delete().eq("id", professional.id);
      await adminClient.auth.admin.deleteUser(userId);
      console.error("membership creation failed", linkErr);
      throw new RequestError("MEMBERSHIP_CREATE_FAILED", "O acesso não foi criado porque o vínculo com a loja não pôde ser salvo.", 500);
    }

    if (service_ids.length) {
      const { data: allowedServices, error: servicesError } = await adminClient.from("services").select("id").eq("establishment_id", establishment_id).in("id", service_ids);
      if (servicesError || allowedServices?.length !== new Set(service_ids).size) {
        await adminClient.from("establishment_users").delete().eq("establishment_id", establishment_id).eq("user_id", userId);
        await adminClient.from("professionals").delete().eq("id", professional.id);
        await adminClient.auth.admin.deleteUser(userId);
        throw new RequestError("INVALID_SERVICES", "Um ou mais serviços selecionados são inválidos.");
      }
      const { error: assignmentsError } = await adminClient.from("service_professionals").insert(
        [...new Set(service_ids)].map((service_id) => ({ establishment_id, service_id, professional_id: professional.id })),
      );
      if (assignmentsError) {
        await adminClient.from("establishment_users").delete().eq("establishment_id", establishment_id).eq("user_id", userId);
        await adminClient.from("professionals").delete().eq("id", professional.id);
        await adminClient.auth.admin.deleteUser(userId);
        console.error("service assignments failed", assignmentsError);
        throw new RequestError("PROFILE_CREATE_FAILED", "O acesso não foi criado porque as permissões profissionais não puderam ser salvas.", 500);
      }
    }

    return new Response(JSON.stringify({ user_id: userId, professional_id: professional.id }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    const known = e instanceof RequestError;
    if (!known) console.error("create-staff-user unexpected error", e);
    return new Response(JSON.stringify({ code: known ? e.code : "INTERNAL_ERROR", error: known ? e.message : "Não foi possível cadastrar o funcionário." }), { status: known ? e.status : 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
