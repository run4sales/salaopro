const base = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api.asaas.com/v3';

export class AsaasError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function asaasRequest<T>(apiKey: string, path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { access_token: apiKey, 'Content-Type': 'application/json', 'User-Agent': 'BeautyCore/1.0' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const descriptions = payload?.errors?.map((error: { description?: string }) => error.description).filter(Boolean).join('; ');
    throw new AsaasError(response.status, `Asaas HTTP ${response.status}: ${descriptions || 'Não foi possível concluir a comunicação.'}`);
  }
  if (!payload || typeof payload !== 'object') throw new Error('Resposta inválida do Asaas.');
  return payload as T;
}

export const PAYMENT_EVENTS = [
  'PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_RESTORED', 'PAYMENT_REFUNDED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE', 'PAYMENT_CHARGEBACK_REQUESTED',
];

/** Never return or log the provider webhook object: it contains authToken. */
export async function ensureAsaasWebhook(apiKey: string, url: string): Promise<void> {
  const authToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
  if (!authToken) throw new Error('Token de notificações Asaas não configurado.');
  type Hook = { id: string; url: string; enabled: boolean; interrupted: boolean; events?: string[]; authToken?: string; sendType?: string };
  const hooks: Hook[] = [];
  let offset = 0;
  while (true) {
    const page = await asaasRequest<{ data: Hook[]; hasMore: boolean }>(apiKey, `/webhooks?limit=100&offset=${offset}`);
    hooks.push(...page.data);
    if (!page.hasMore) break;
    if (!page.data.length) throw new Error('Paginação de notificações Asaas incompleta.');
    offset += page.data.length;
  }
  const matching = hooks.filter((hook) => hook.url === url);
  if (matching.length > 1) throw new Error('Existem notificações Asaas duplicadas para este aplicativo; revise antes de continuar.');
  const hook = matching[0];
  if (hook?.enabled && !hook.interrupted && hook.sendType === 'SEQUENTIALLY'
    && hook.authToken === authToken && PAYMENT_EVENTS.every((event) => hook.events?.includes(event))) return;
  await asaasRequest(apiKey, hook ? `/webhooks/${hook.id}` : '/webhooks', hook ? 'PUT' : 'POST', {
    name: 'Beauty Core — Faturas', url, authToken, apiVersion: 3,
    enabled: true, interrupted: false, sendType: 'SEQUENTIALLY',
    events: [...new Set([...(hook?.events ?? []), ...PAYMENT_EVENTS])],
  });
}