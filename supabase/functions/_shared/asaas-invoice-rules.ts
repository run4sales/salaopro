export type Invoice = { id: string; dueDate?: string; dateCreated?: string; paymentDate?: string; clientPaymentDate?: string; confirmedDate?: string; status?: string };
/** Due date identifies the billing cycle; payment date must not reorder old invoices. */
export function newestInvoice<T extends Invoice>(payments: T[], today = new Date().toISOString().slice(0, 10)): T | null {
  const current = payments.filter((payment) => payment.dueDate && payment.dueDate <= today);
  const sort = (rows: T[]) => [...rows].sort((a, b) =>
    (b.dueDate ?? '').localeCompare(a.dueDate ?? '')
      || (b.dateCreated ?? '').localeCompare(a.dateCreated ?? '')
      || b.id.localeCompare(a.id),
  );
  const latestCurrent = sort(current)[0];
  const paid = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']);
  // Early payments count, but cannot conceal an unpaid current cycle.
  if (latestCurrent && !paid.has(latestCurrent.status ?? '')) return latestCurrent;
  const latestPaid = sort(payments.filter((payment) => paid.has(payment.status ?? '')))[0];
  return latestPaid ?? latestCurrent ?? sort(payments)[0] ?? null;
}