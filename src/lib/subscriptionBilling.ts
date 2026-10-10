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

export function subscriptionDeadline(subscription: {
  status: string;
  trial_ends_at?: string | null;
  current_invoice_status?: string | null;
  current_invoice_due_date?: string | null;
  next_billing_at?: string | null;
} | undefined) {
  if (!subscription) return null;
  if (subscription.status === 'trial') return subscription.trial_ends_at ?? null;
  return ['PENDING', 'OVERDUE'].includes(subscription.current_invoice_status ?? '')
    ? subscription.current_invoice_due_date ?? subscription.next_billing_at ?? null
    : subscription.next_billing_at ?? null;
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
