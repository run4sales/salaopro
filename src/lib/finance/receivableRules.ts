export const receivableLabels = { pending: "Pendente", partial: "Parcialmente recebido", overdue: "Vencido", partial_overdue: "Parcialmente recebido e vencido", received: "Recebido", canceled: "Cancelado" };
export function brazilToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export type Debt = { amount: number; received_amount: number; due_date: string; canceled_at: string | null };
export function receivableBalance(debt: Debt) { return Math.round((Number(debt.amount) - Number(debt.received_amount)) * 100) / 100; }
export function receivableStatus(debt: Debt, today = brazilToday()): keyof typeof receivableLabels {
  if (debt.canceled_at) return "canceled";
  if (receivableBalance(debt) <= 0) return "received";
  if (debt.due_date < today) return Number(debt.received_amount) > 0 ? "partial_overdue" : "overdue";
  return Number(debt.received_amount) > 0 ? "partial" : "pending";
}
export function validateReceipt(debt: Debt, amount: number) {
  return !debt.canceled_at && Number.isFinite(amount) && amount > 0 && Math.abs(Math.round(amount * 100) - amount * 100) < 0.000001 && amount <= receivableBalance(debt);
}
export function receivableTotals(debts: Debt[], payments: { amount: number; payment_date: string }[], month = brazilToday().slice(0, 7), today = brazilToday()) {
  const open = debts.filter(d => !["received", "canceled"].includes(receivableStatus(d, today)));
  const sum = (list: Debt[]) => Math.round(list.reduce((s,d) => s + receivableBalance(d), 0) * 100) / 100;
  return { open: sum(open), overdue: sum(open.filter(d => d.due_date < today)), upcoming: sum(open.filter(d => d.due_date >= today)), partial: sum(open.filter(d => Number(d.received_amount) > 0)), received: Math.round(payments.filter(p => p.payment_date.startsWith(month)).reduce((s,p) => s + Number(p.amount),0) * 100) / 100 };
}