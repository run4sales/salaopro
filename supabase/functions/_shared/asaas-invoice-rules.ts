export type Invoice = { id: string; dueDate?: string; dateCreated?: string; paymentDate?: string; clientPaymentDate?: string; confirmedDate?: string; status?: string };
/** Due date identifies the billing cycle; payment date must not reorder old invoices. */
export function newestInvoice<T extends Invoice>(payments: T[], today = new Date().toISOString().slice(0, 10)): T | null {
  const current = payments.filter((payment) => payment.dueDate && payment.dueDate <= today);
  return [...(current.length ? current : payments)].sort((a, b) =>
    (b.dueDate ?? '').localeCompare(a.dueDate ?? '')
      || (b.dateCreated ?? '').localeCompare(a.dateCreated ?? '')
      || b.id.localeCompare(a.id),
  )[0] ?? null;
}