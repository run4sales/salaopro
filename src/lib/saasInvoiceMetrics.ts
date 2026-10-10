export type SaaSInvoice = { id: string; establishment_id: string; status: string; value: number; net_value: number | null; due_date: string | null; payment_date: string | null };
const paid = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']);
export function brazilMonth(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(date);
}
export function previousBillingMonth(now = new Date()) {
  const month = brazilMonth(now.toISOString()) ?? '';
  const [year, number] = month.split('-').map(Number);
  return `${number === 1 ? year - 1 : year}-${String(number === 1 ? 12 : number - 1).padStart(2, '0')}`;
}
export function invoiceMonthMetrics(invoices: SaaSInvoice[], month: string, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const received = invoices.filter(i => paid.has(i.status) && brazilMonth(i.payment_date) === month);
  const overdue = invoices.filter(i => ['PENDING', 'OVERDUE'].includes(i.status) && i.due_date && i.due_date < today && brazilMonth(i.due_date) === month);
  const cents = (rows: SaaSInvoice[]) => rows.reduce((sum, row) => sum + Math.round(Number(row.value) * 100), 0) / 100;
  return { receivedCount: received.length, received: cents(received), overdueCount: overdue.length, overdue: cents(overdue), overdueCompanies: new Set(overdue.map(i => i.establishment_id)).size };
}