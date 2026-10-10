import assert from 'node:assert/strict';
import test from 'node:test';
import { invoiceMonthMetrics, brazilMonth, previousBillingMonth } from '../src/lib/saasInvoiceMetrics.ts';
const invoice = (id, status, value, due_date, payment_date = null) => ({ id, establishment_id: id, status, value, net_value: null, due_date, payment_date });
test('cash follows payment date, unpaid balance follows due date', () => {
  const result = invoiceMonthMetrics([
    invoice('a','RECEIVED',29.9,'2026-08-10','2026-09-10'),
    invoice('b','CONFIRMED',69.9,'2026-09-10','2026-10-02'),
    invoice('c','OVERDUE',109.9,'2026-09-10'),
    invoice('d','PENDING',29.9,'2026-11-10'),
    invoice('e','REFUNDED',99,'2026-09-10','2026-09-12'),
  ], '2026-09', new Date('2026-10-10T17:54:00Z'));
  assert.equal(result.received,29.9);
  assert.equal(result.receivedCount,1);
  assert.equal(result.overdue,109.9);
  assert.equal(result.overdueCount,1);
});
test('Brazil month boundaries and previous month include year rollover', () => {
  assert.equal(brazilMonth('2026-10-01T02:59:00Z'),'2026-09');
  assert.equal(previousBillingMonth(new Date('2026-01-10T12:00:00Z')),'2025-12');
});