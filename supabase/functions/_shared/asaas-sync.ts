import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { asaasRequest, AsaasError } from './asaas-client.ts';
import { newestInvoice } from './asaas-invoice-rules.ts';

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
  manual_blocked_at: string | null;
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
  dateCreated?: string;
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
};

async function asaasGet<T>(path: string, apiKey: string): Promise<T> {
  return asaasRequest<T>(apiKey, path);
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
  return newestInvoice(payments);
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
  const { data: local, error: localError } = await admin.from('subscriptions').select(
    'id, establishment_id, status, plan_id, monthly_amount, asaas_customer_id, asaas_subscription_id, pending_plan_id, manual_blocked_at',
  ).eq('establishment_id', establishmentId).maybeSingle();
  if (localError) throw localError;
  if (!local) throw new Error(`Assinatura local não encontrada para ${establishmentId}`);
  const subscription = local as LocalSubscription;

  let customer: AsaasCustomer | null = null;
  if (subscription.asaas_customer_id) {
    customer = await asaasGet<AsaasCustomer>(`/customers/${subscription.asaas_customer_id}`, apiKey)
      .catch((error) => { if (error instanceof AsaasError && error.status === 404) return null; throw error; });
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
  const latestPayment = newestPayment(payments);
  const paidPayment = newestPayment(payments.filter((row) => PAID_STATUSES.has(row.status ?? '')));
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
      raw: { id: payment.id, status: payment.status, dueDate: payment.dueDate },
    }, { onConflict: 'asaas_payment_id' });
    if (error) throw error;
  }

  const remoteStatus = latestPayment?.status ?? '';
  const derivedStatus = remoteStatus === 'OVERDUE'
    ? 'past_due'
    : CANCELED_STATUSES.has(remoteStatus)
    ? 'canceled'
    : PAID_STATUSES.has(remoteStatus)
    ? 'active'
    : subscription.status;
  const newStatus = subscription.manual_blocked_at ? subscription.status : derivedStatus;
  const lastPaymentAt = paidPayment
    ? paidPayment.paymentDate ?? paidPayment.clientPaymentDate ?? paidPayment.confirmedDate ?? new Date().toISOString()
    : null;
  const updates: Json = {
    asaas_customer_id: customer.id,
    asaas_subscription_id: remoteSubscription.id,
    billing_type: remoteSubscription.billingType ?? latestPayment?.billingType ?? null,
    monthly_amount: Number(remoteSubscription.value ?? subscription.monthly_amount),
  };
  if (!subscription.manual_blocked_at) updates.status = newStatus;
  if (paidPayment) updates.last_payment_at = lastPaymentAt;
  if (latestPayment?.status === 'OVERDUE' && latestPayment.dueDate) {
    updates.next_billing_at = new Date(`${latestPayment.dueDate}T12:00:00.000Z`).toISOString();
  }
  if (latestPayment && PAID_STATUSES.has(latestPayment.status ?? '')) {
    updates.next_billing_at = remoteSubscription.nextDueDate
      ? new Date(`${remoteSubscription.nextDueDate}T12:00:00.000Z`).toISOString()
      : null;
    updates.trial_ends_at = null;
    updates.canceled_at = null;
    updates.grace_started_at = null;
    updates.grace_ends_at = null;
    updates.grace_cycle_key = null;
    if (subscription.pending_plan_id) {
      const { data: pendingPlan, error: planError } = await admin.from('subscription_plans')
        .select('id, monthly_price').eq('id', subscription.pending_plan_id).maybeSingle();
      if (planError) throw planError;
      if (pendingPlan && Number(pendingPlan.monthly_price) === Number(latestPayment.value)) {
        updates.plan_id = pendingPlan.id;
        updates.pending_plan_id = null;
        updates.pending_plan_effective_at = null;
      }
    }
  }
  const { error: updateError } = await admin.from('subscriptions').update(updates).eq('id', subscription.id);
  if (updateError) throw updateError;
  trace.push(`Status atualizado: ${subscription.status} -> ${newStatus}`);
  if (subscription.manual_blocked_at) trace.push('Bloqueio manual preservado; cobrança registrada sem liberar acesso.');
  if (latestPayment && PAID_STATUSES.has(latestPayment.status ?? '')) trace.push('Trial encerrado. Conta liberada.');

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
    details: { trace, manual_block_preserved: Boolean(subscription.manual_blocked_at) },
  });
  if (logError) throw logError;
  return result;
}
