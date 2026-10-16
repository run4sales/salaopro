const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
export function billingDaysLeft(due: string | null | undefined, now = new Date()): number | null {
  if (!due) return null;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : calendar.format(new Date(due));
  const difference = (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${calendar.format(now)}T00:00:00Z`)) / 86400000;
  return Number.isFinite(difference) ? difference : null;
}
export function billingNotice(due: string | null | undefined, now = new Date()) {
  const days = billingDaysLeft(due, now);
  if (days === null || days > 3) return null;
  if (days > 0) return { tone: 'upcoming', message: `Sua fatura vence em ${days} dia(s).` } as const;
  if (days === 0) return { tone: 'due', message: 'Sua fatura vence hoje. Realize o pagamento.' } as const;
  return { tone: 'late', message: days <= -3 ? 'Sua fatura está vencida. O acesso está bloqueado até o pagamento.' : `Sua fatura venceu há ${-days} dia(s). O acesso será bloqueado no terceiro dia de atraso.` } as const;
}

const PROVIDER_PAID = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];

/** A manual authorization governs access only through its authorized day; afterwards Asaas invoices take over again. */
export function manualAuthorizationInEffect(subscription: {
  manual_access_due_date?: string | null;
  manual_access_status?: string | null;
  current_invoice_status?: string | null;
} | null | undefined, now = new Date()) {
  if (!subscription?.manual_access_due_date) return false;
  const days = billingDaysLeft(subscription.manual_access_due_date, now);
  if (days === null || days < 0) return false;
  const grants = ['active', 'trial'].includes(subscription.manual_access_status ?? '');
  return grants || !PROVIDER_PAID.includes(subscription.current_invoice_status ?? '');
}

export function subscriptionDeadline(subscription: {
  status: string;
  manual_access_due_date?: string | null;
  manual_access_status?: string | null;
  trial_ends_at?: string | null;
  current_invoice_status?: string | null;
  current_invoice_due_date?: string | null;
  next_billing_at?: string | null;
} | undefined, now = new Date()) {
  if (!subscription) return null;
  if (manualAuthorizationInEffect(subscription, now)) return subscription.manual_access_due_date ?? null;
  if (subscription.status === 'trial' && !subscription.manual_access_due_date) return subscription.trial_ends_at ?? null;
  return ['PENDING', 'OVERDUE'].includes(subscription.current_invoice_status ?? '')
    ? subscription.current_invoice_due_date ?? subscription.next_billing_at ?? null
    : subscription.next_billing_at ?? null;
}

export function hasValidManualAccess(subscription: {
  manual_access_due_date?: string | null;
  manual_access_status?: string | null;
  manual_blocked_at?: string | null;
} | null | undefined, now = new Date()) {
  if (!subscription || subscription.manual_blocked_at || !['active', 'trial'].includes(subscription.manual_access_status ?? '')) return false;
  const days = billingDaysLeft(subscription.manual_access_due_date, now);
  return days !== null && days >= 0;
}

/** Customer access warnings never describe a provider debt as an expired manual authorization. */
export function subscriptionAccessNotice(subscription: Parameters<typeof subscriptionDeadline>[0] & {
  manual_access_status?: string | null;
  manual_blocked_at?: string | null;
  state?: string | null;
}, now = new Date()) {
  if (hasValidManualAccess(subscription, now)) return null;
  // Once the manual date has passed, the salon follows its Asaas invoices: a paid provider cycle shows no warning.
  if (subscription?.state === 'active_paid') return null;
  const notice = billingNotice(subscriptionDeadline(subscription, now), now);
  if (!notice || !manualAuthorizationInEffect(subscription, now)) return notice;
  const days = billingDaysLeft(subscription?.manual_access_due_date, now) ?? 0;
  return { ...notice, message: `Seu prazo autorizado vence ${days === 0 ? 'hoje' : `em ${days} dia(s)`}.` };
}

export function billingCountdown(due: string | null | undefined, now = new Date()) {
  const days = billingDaysLeft(due, now);
  if (days === null) return 'Sem vencimento informado';
  if (days === 0) return 'Vence hoje';
  const amount = Math.abs(days);
  const period = `${amount} ${amount === 1 ? 'dia' : 'dias'}`;
  return days < 0 ? `Vencido há ${period}` : `Faltam ${period}`;
}

export function formatBillingDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
}
