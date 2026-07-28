import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const ASAAS_BASE = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api.asaas.com/v3';
const PAID_STATUSES = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']);
const CANCELED_STATUSES = new Set(['REFUNDED', 'DELETED', 'CANCELED']);

type Json = Record<string, unknown>;
type LocalSubscription = {
  id: string;
  establishment_id: string;
  status: string;
  plan_id: string | null;
  monthly_amount: number;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  pending_plan_id: string | null;
};

type AsaasCustomer = Json & { id: string; externalReference?: string };
type AsaasSubscription = Json & {
  id: string;
  customer: string;
  status?: string;
  externalReference?: string;
  nextDueDate?: string;
  value?: number;
  billingType?: string;
};
type AsaasPayment = Json & {
  id: string;
  customer?: string;
  subscription?: string;
  status?: string;
  value?: number;
  netValue?: number;
  billingType?: string;
  dueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  confirmedDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
};

export type SyncResult = {
  establishment_id: string;
  customer_id: string;
  subscription_id: string;
  payment_id: string | null;
  payment_status: string | null;
  previous_status: string;
  status: string;
  changed: boolean;
  plan_id: string | null;
  duration_ms: number;
  trace: string[];
  warnings: string[];
};

function asaasHeaders(apiKey: string) {
  return { access_token: apiKey, 'Content-Type': 'application/json', 'User-Agent': 'BeautyCore/1.0' };
}

async function asaasGet<T>(path: string, apiKey: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${ASAAS_BASE}${path}`, {
      headers: asaasHeaders(apiKey),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Asaas ${response.status} em ${path}: ${JSON.stringify(payload)}`);
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function asaasList<T>(path: string, apiKey: string): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  do {
    const separator = path.includes('?') ? '&' : '?';
    const page = await asaasGet<{ data?: T[]; hasMore?: boolean }>(
      `${path}${separator}limit=100&offset=${offset}`,
      apiKey,
    );
    rows.push(...(page.data ?? []));
    if (!page.hasMore || (page.data?.length ?? 0) === 0) break;
    offset += page.data?.length ?? 0;
  } while (offset < 10_000);
  return rows;
}

function newestPayment(payments: AsaasPayment[]) {
  return [...payments].sort((a, b) => {
    const aDate = a.paymentDate ?? a.clientPaymentDate ?? a.confirmedDate ?? a.dueDate ?? '';
    const bDate = b.paymentDate ?? b.clientPaymentDate ?? b.confirmedDate ?? b.dueDate ?? '';
    return bDate.localeCompare(aDate);
  })[0] ?? null;
}

function chooseSubscription(rows: AsaasSubscription[], storedId: string | null, establishmentId: string) {
  const associated = rows.filter((row) => !row.externalReference || row.externalReference === establishmentId);
  return associated.find((row) => row.id === storedId)
    ?? associated.find((row) => row.externalReference === establishmentId && row.status === 'ACTIVE')
    ?? associated.find((row) => row.externalReference === establishmentId)
    ?? associated.find((row) => row.status === 'ACTIVE')
    ?? associated[0]
    ?? null;
}

export async function syncAsaasSubscription(
  admin: SupabaseClient,
  apiKey: string,
  establishmentId: string,
  source: 'webhook' | 'manual' | 'audit',
): Promise<SyncResult> {
  const started = Date.now();
  const trace = [`[${source}] Buscando assinatura do estabelecimento ${establishmentId}`];
  const warnings: string[] = [];
  const { data: local, error: localError } = await admin.from('subscriptions').select(
    'id, establishment_id, status, plan_id, monthly_amount, asaas_customer_id, asaas_subscription_id, pending_plan_id',
  ).eq('establishment_id', establishmentId).maybeSingle();
  if (localError) throw localError;
  if (!local) throw new Error(`Assinatura local não encontrada para ${establishmentId}`);
  const subscription = local as LocalSubscription;

  let customer: AsaasCustomer | null = null;
  if (subscription.asaas_customer_id) {
    customer = await asaasGet<AsaasCustomer>(`/customers/${subscription.asaas_customer_id}`, apiKey)
      .catch(() => null);
    if (customer?.externalReference && customer.externalReference !== establishmentId) {
      trace.push(`Customer armazenado ${customer.id} pertence a ${customer.externalReference}; buscando associação correta`);
      customer = null;
    }
  }
  if (!customer) {
    const customers = await asaasList<AsaasCustomer>(
      `/customers?externalReference=${encodeURIComponent(establishmentId)}`,
      apiKey,
    );
    const exactCustomers = customers.filter((row) => row.externalReference === establishmentId);
    if (exactCustomers.length > 1) {
      throw new Error(`Associação ambígua: ${exactCustomers.length} customers usam externalReference ${establishmentId}`);
    }
    customer = exactCustomers[0] ?? null;
  }
  if (!customer) throw new Error(`Customer Asaas não encontrado para externalReference ${establishmentId}`);
  trace.push(`Customer encontrado: ${customer.id}`);

  const subscriptions = await asaasList<AsaasSubscription>(
    `/subscriptions?customer=${encodeURIComponent(customer.id)}`,
    apiKey,
  );
  const remoteSubscription = chooseSubscription(subscriptions, subscription.asaas_subscription_id, establishmentId);
  if (!remoteSubscription) throw new Error(`Subscription Asaas não encontrada para customer ${customer.id}`);
  trace.push(`Subscription encontrada: ${remoteSubscription.id} (${remoteSubscription.status ?? 'sem status'})`);

  const payments = await asaasList<AsaasPayment>(
    `/subscriptions/${encodeURIComponent(remoteSubscription.id)}/payments`,
    apiKey,
  );
  const paidPayment = newestPayment(payments.filter((row) => PAID_STATUSES.has(row.status ?? '')));
  const latestPayment = newestPayment(payments);
  trace.push(`Último pagamento: ${latestPayment?.id ?? 'nenhum'} (${latestPayment?.status ?? 'sem status'})`);

  for (const payment of payments) {
    const { error } = await admin.from('subscription_payments').upsert({
      establishment_id: establishmentId,
      subscription_id: subscription.id,
      asaas_payment_id: payment.id,
      asaas_subscription_id: remoteSubscription.id,
      value: Number(payment.value ?? 0),
      net_value: payment.netValue == null ? null : Number(payment.netValue),
      status: payment.status ?? 'UNKNOWN',
      billing_type: payment.billingType ?? null,
      due_date: payment.dueDate ?? null,
      payment_date: payment.paymentDate ?? payment.clientPaymentDate ?? payment.confirmedDate ?? null,
      invoice_url: payment.invoiceUrl ?? null,
      bank_slip_url: payment.bankSlipUrl ?? null,
      raw: payment,
    }, { onConflict: 'asaas_payment_id' });
    if (error) throw error;
  }

  const newStatus = latestPayment?.status === 'OVERDUE'
    ? 'past_due'
    : CANCELED_STATUSES.has(latestPayment?.status ?? '')
    ? 'canceled'
    : paidPayment
    ? 'active'
    : subscription.status;
  const lastPaymentAt = paidPayment
    ? paidPayment.paymentDate ?? paidPayment.clientPaymentDate ?? paidPayment.confirmedDate ?? new Date().toISOString()
    : null;
  const updates: Json = {
    asaas_customer_id: customer.id,
    asaas_subscription_id: remoteSubscription.id,
    billing_type: remoteSubscription.billingType ?? latestPayment?.billingType ?? null,
    monthly_amount: Number(remoteSubscription.value ?? subscription.monthly_amount),
    next_billing_at: remoteSubscription.nextDueDate
      ? new Date(`${remoteSubscription.nextDueDate}T12:00:00.000Z`).toISOString()
      : null,
    status: newStatus,
  };
  if (paidPayment) {
    updates.last_payment_at = lastPaymentAt;
    updates.trial_ends_at = null;
    updates.canceled_at = null;
    updates.grace_started_at = null;
    updates.grace_ends_at = null;
    updates.grace_cycle_key = null;
  }
  const { error: updateError } = await admin.from('subscriptions').update(updates).eq('id', subscription.id);
  if (updateError) throw updateError;
  trace.push(`Status atualizado: ${subscription.status} -> ${newStatus}`);
  if (paidPayment) trace.push('Trial encerrado. Conta liberada.');

  const result: SyncResult = {
    establishment_id: establishmentId,
    customer_id: customer.id,
    subscription_id: remoteSubscription.id,
    payment_id: latestPayment?.id ?? null,
    payment_status: latestPayment?.status ?? null,
    previous_status: subscription.status,
    status: newStatus,
    changed: subscription.status !== newStatus
      || subscription.asaas_customer_id !== customer.id
      || subscription.asaas_subscription_id !== remoteSubscription.id,
    plan_id: subscription.plan_id,
    duration_ms: Date.now() - started,
    trace,
    warnings,
  };
  const { error: logError } = await admin.from('asaas_sync_logs').insert({
    source,
    establishment_id: establishmentId,
    asaas_customer_id: customer.id,
    asaas_subscription_id: remoteSubscription.id,
    asaas_payment_id: latestPayment?.id ?? null,
    previous_status: subscription.status,
    new_status: newStatus,
    payment_status: latestPayment?.status ?? null,
    plan_id: subscription.plan_id,
    changed: result.changed,
    duration_ms: result.duration_ms,
    details: { trace, subscription: remoteSubscription, latest_payment: latestPayment },
  });
  // The subscription has already been reconciled at this point. An audit-log
  // outage must not turn a successful billing update into a false sync error.
  if (logError) {
    const warning = `Assinatura sincronizada, mas o log de auditoria falhou: ${logError.message}`;
    warnings.push(warning);
    trace.push(warning);
    console.error('[asaas-sync] audit log error', {
      establishmentId,
      error: logError.message,
    });
  }
  return result;
}
