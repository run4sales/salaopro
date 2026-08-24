/**
 * Extrai a mensagem real de erro de uma chamada a Edge Function.
 *
 * - FunctionsHttpError: a função respondeu com erro HTTP e o corpo JSON
 *   (em `error.context`) carrega a mensagem de negócio real (`{ error: "..." }`).
 * - FunctionsFetchError ("Failed to send a request to the Edge Function"):
 *   a requisição nem chegou ao servidor (rede/CORS) — não há mensagem útil
 *   no erro padrão, então traduzimos para o usuário.
 */
export async function extractEdgeFunctionError(error: unknown): Promise<string> {
  const err = error as { name?: string; message?: string; context?: Response } | null;

  try {
    const context = err?.context;
    if (context && typeof context.clone === "function") {
      const body: unknown = await context.clone().json().catch(() => null);
      if (body && typeof body === "object") {
        const payload = body as { error?: unknown; message?: unknown };
        if (typeof payload.error === "string" && payload.error) return payload.error;
        if (typeof payload.message === "string" && payload.message) return payload.message;
      }
    }
  } catch {
    // ignora e cai no fallback
  }

  if (err?.name === "FunctionsFetchError" || /failed to send a request/i.test(err?.message ?? "")) {
    return "Falha de comunicação com o servidor. Verifique sua conexão com a internet e tente novamente.";
  }

  return err?.message ?? "Erro inesperado";
}
