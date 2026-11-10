import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGE_CHARS = 2000;
const HISTORY_LIMIT = 40;
const MAX_TOOL_ROUNDS = 6;
const MODEL = "openai/gpt-6-astra";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

class RequestError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "revenue_summary",
      description: "Faturamento realizado (vendas não excluídas), quantidade de vendas, ticket médio, divisão serviços/produtos, formas de pagamento e comparativo com o período anterior de mesmo tamanho.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "Início do período em ISO 8601 (ex.: 2026-11-01T00:00:00-03:00)" },
          end: { type: "string", description: "Fim do período (exclusivo) em ISO 8601" },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "expenses_summary",
      description: "Despesas e contas a pagar por data de vencimento: total, pago, pendente, vencido e por categoria.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "Data inicial (AAAA-MM-DD)" },
          end: { type: "string", description: "Data final (AAAA-MM-DD)" },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "commissions_summary",
      description: "Comissões dos profissionais no período, respeitando a divisão entre múltiplos profissionais.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string" },
          end: { type: "string" },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inactive_clients",
      description: "Clientes sem atendimento há pelo menos N dias, com faixas (30-60, 60-90, 90+), quem não tem agendamento futuro e lista de até 50 clientes.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "integer", description: "Dias sem atendimento (padrão 30)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "top_services",
      description: "Serviços e produtos mais vendidos (quantidade, faturamento, ticket médio) e mais agendados no período.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string" },
          end: { type: "string" },
          limit: { type: "integer" },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "professional_performance",
      description: "Desempenho dos profissionais: atendimentos, faturamento de agendamentos e cancelamentos no período.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string" },
          end: { type: "string" },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forecast",
      description: "Previsão de recebimento: agendamentos futuros não cancelados com o valor combinado (snapshot), no mês e no total.",
      parameters: { type: "object", properties: {} },
    },
  },
];

type ToolCall = { id: string; function: { name: string; arguments: string } };

async function executeTool(
  adminClient: ReturnType<typeof createClient>,
  establishmentId: string,
  call: ToolCall,
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return JSON.stringify({ error: "argumentos inválidos" });
  }

  const name = call.function.name;
  let rpc: string;
  let params: Record<string, unknown>;

  switch (name) {
    case "revenue_summary":
      rpc = "beauty_ai_revenue_summary";
      params = { p_establishment: establishmentId, p_start: args.start, p_end: args.end };
      break;
    case "expenses_summary":
      rpc = "beauty_ai_expenses_summary";
      params = { p_establishment: establishmentId, p_start: args.start, p_end: args.end };
      break;
    case "commissions_summary":
      rpc = "beauty_ai_commissions_summary";
      params = { p_establishment: establishmentId, p_start: args.start, p_end: args.end };
      break;
    case "inactive_clients":
      rpc = "beauty_ai_inactive_clients";
      params = { p_establishment: establishmentId, p_days: typeof args.days === "number" ? args.days : 30 };
      break;
    case "top_services":
      rpc = "beauty_ai_top_services";
      params = { p_establishment: establishmentId, p_start: args.start, p_end: args.end, p_limit: typeof args.limit === "number" ? args.limit : 10 };
      break;
    case "professional_performance":
      rpc = "beauty_ai_professional_performance";
      params = { p_establishment: establishmentId, p_start: args.start, p_end: args.end };
      break;
    case "forecast":
      rpc = "beauty_ai_forecast";
      params = { p_establishment: establishmentId };
      break;
    default:
      return JSON.stringify({ error: "ferramenta desconhecida" });
  }

  const { data, error } = await adminClient.rpc(rpc, params);
  if (error) {
    console.error("tool error", rpc, error.message);
    return JSON.stringify({ error: "consulta indisponível no momento" });
  }
  return JSON.stringify(data);
}

function systemPrompt(todaySP: string) {
  return `Você é a Beauty IA, copiloto de gestão do salão dentro do sistema Beauty Core. Hoje é ${todaySP} (fuso America/Sao_Paulo).

Regras obrigatórias:
- Responda sempre em português brasileiro, de forma clara, profissional e objetiva.
- NUNCA invente valores, nomes ou números. Use somente os dados retornados pelas ferramentas de consulta.
- Sempre que a pergunta envolver números do negócio, chame a ferramenta adequada antes de responder. Se faltar dado, diga claramente que não encontrou a informação.
- Interprete expressões de tempo (hoje, ontem, esta semana, este mês, mês passado, últimos 7/30/90 dias, este ano) a partir da data de hoje, no fuso de São Paulo. "Este mês" = do dia 1 do mês corrente até agora.
- Diferencie com clareza: faturamento realizado (vendas concluídas), valores previstos (agendamentos futuros), valores pendentes e despesas pagas vs. lançadas. Nunca confunda faturamento com lucro.
- Formate valores monetários em reais (R$ 1.234,56).
- Ao comparar períodos, deixe explícito quais períodos foram comparados.
- Quando relevante, acrescente um "Insight Beauty IA" com uma recomendação prática fundamentada nos dados. Nunca apresente hipótese como fato.
- Use listas e destaques para organizar a resposta. Seja concisa.`;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (!isAllowedBrowserOrigin(req)) return json({ error: "Origin não permitida" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "Payload muito grande" }, 413);

  let consumed: { establishmentId: string; userId: string } | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new RequestError("UNAUTHENTICATED", "Sessão inválida. Entre novamente.", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gatewayKey = Deno.env.get("LOVABLE_API_KEY");
    if (!gatewayKey) {
      console.error("LOVABLE_API_KEY ausente");
      throw new RequestError("AI_UNAVAILABLE", "A Beauty IA está temporariamente indisponível. Tente novamente em instantes.", 503);
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authErr } = await userClient.auth.getUser(token);
    const callerId = authData.user?.id;
    if (authErr || !callerId) throw new RequestError("UNAUTHENTICATED", "Sessão inválida. Entre novamente.", 401);

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) throw new RequestError("PAYLOAD_TOO_LARGE", "Mensagem muito longa.", 413);
    const body = JSON.parse(rawBody);
    const message = String(body?.message ?? "").trim();
    if (!message || message.length > MAX_MESSAGE_CHARS) {
      throw new RequestError("INVALID_INPUT", `Escreva uma pergunta de até ${MAX_MESSAGE_CHARS} caracteres.`);
    }

    // Resolve o estabelecimento do chamador: dono do perfil ou gestor ativo.
    const { data: ownerProfile } = await adminClient.from("profiles").select("id").eq("user_id", callerId).maybeSingle();
    let establishmentId: string | null = ownerProfile?.id ?? null;
    if (!establishmentId) {
      const { data: membership } = await adminClient
        .from("establishment_users")
        .select("establishment_id")
        .eq("user_id", callerId)
        .eq("active", true)
        .in("role", ["owner", "admin"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      establishmentId = membership?.establishment_id ?? null;
    }
    if (!establishmentId) {
      throw new RequestError("FORBIDDEN", "A Beauty IA é exclusiva do proprietário ou administrador do salão.", 403);
    }

    // Consumo atômico: valida plano, liberação do super admin, assinatura e limite.
    const { data: access, error: accessErr } = await adminClient.rpc("consume_beauty_ai_interaction", {
      p_establishment: establishmentId,
      p_user: callerId,
    });
    if (accessErr) {
      console.error("consume error", accessErr.message);
      throw new RequestError("ACCESS_CHECK_FAILED", "Não foi possível validar seu acesso à Beauty IA.", 500);
    }
    if (!access?.allowed) {
      const reason = !access?.plan_eligible
        ? "A Beauty IA está disponível nos planos Profissional e Empresa. Fale com nosso time para fazer upgrade."
        : !access?.enabled
          ? "A Beauty IA ainda não foi liberada para este salão. Entre em contato com nosso suporte."
          : !access?.subscription_regular
            ? "O acesso à Beauty IA está suspenso porque a assinatura do salão não está regular."
            : "Você atingiu o limite de utilização da Beauty IA neste mês. Entre em contato com nosso suporte para consultar a disponibilidade de mais interações.";
      return json({ error: reason, code: "ACCESS_DENIED", access }, 403);
    }
    consumed = { establishmentId, userId: callerId };

    // Histórico da conversa única do salão.
    const { data: history } = await adminClient
      .from("beauty_ai_messages")
      .select("role, content")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const historyMessages = (history ?? []).reverse();

    const todaySP = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt(todaySP) },
      ...historyMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    // Loop de ferramentas: a IA pede consultas, o backend executa e devolve os dados.
    let reply = "";
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const gatewayRes = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${gatewayKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages, tools: TOOLS }),
      });

      if (!gatewayRes.ok) {
        const text = await gatewayRes.text();
        console.error("gateway error", gatewayRes.status, text.slice(0, 500));
        throw new RequestError("AI_UNAVAILABLE", "A Beauty IA está temporariamente indisponível. Tente novamente em instantes.", 503);
      }

      const completion = await gatewayRes.json();
      const choice = completion.choices?.[0];
      const assistantMessage = choice?.message;
      if (!assistantMessage) {
        console.error("gateway sem resposta", JSON.stringify(completion).slice(0, 500));
        throw new RequestError("AI_UNAVAILABLE", "A Beauty IA não conseguiu responder agora. Tente novamente.", 503);
      }

      const toolCalls: ToolCall[] = assistantMessage.tool_calls ?? [];
      if (toolCalls.length === 0) {
        reply = String(assistantMessage.content ?? "").trim();
        break;
      }

      messages.push(assistantMessage);
      for (const call of toolCalls) {
        const result = await executeTool(adminClient, establishmentId, call);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }

    if (!reply) {
      throw new RequestError("AI_UNAVAILABLE", "A Beauty IA não conseguiu concluir a análise. Tente novamente.", 503);
    }

    // Persiste a conversa.
    const now = new Date().toISOString();
    const { error: insertErr } = await adminClient.from("beauty_ai_messages").insert([
      { establishment_id: establishmentId, user_id: callerId, role: "user", content: message, created_at: now },
      { establishment_id: establishmentId, user_id: null, role: "assistant", content: reply, created_at: new Date(Date.now() + 1).toISOString() },
    ]);
    if (insertErr) console.error("persist error", insertErr.message);

    return json({
      reply,
      usage: {
        used: access.usage_count,
        limit: access.monthly_limit,
        remaining: access.remaining,
      },
    });
  } catch (error) {
    // Falha de IA ou de persistência: devolve a interação consumida.
    if (consumed) {
      try {
        const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await adminClient.rpc("refund_beauty_ai_interaction", {
          p_establishment: consumed.establishmentId,
          p_user: consumed.userId,
          p_reason: error instanceof Error ? error.message : "erro desconhecido",
        });
      } catch (refundErr) {
        console.error("refund error", refundErr);
      }
    }

    if (error instanceof RequestError) return json({ error: error.message, code: error.code }, error.status);
    console.error("unexpected error", error);
    return json({ error: "Erro inesperado. Tente novamente." }, 500);
  }
});
