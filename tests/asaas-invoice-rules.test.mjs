import assert from 'node:assert/strict';
import test from 'node:test';
import { newestInvoice } from '../supabase/functions/_shared/asaas-invoice-rules.ts';

test('late payment of an older cycle cannot hide current overdue invoice', () => {
  const invoices = [
    { id: 'old', dueDate: '2026-09-01', paymentDate: '2026-10-10', status: 'RECEIVED' },
    { id: 'current', dueDate: '2026-10-01', status: 'OVERDUE' },
  ];
  assert.equal(newestInvoice(invoices, '2026-10-10')?.id, 'current');
});

test('future pending invoices cannot hide current unpaid cycle', () => {
  assert.equal(newestInvoice([
    { id: 'current', dueDate: '2026-10-01', status: 'OVERDUE' },
    { id: 'future', dueDate: '2026-11-01', status: 'PENDING' },
  ], '2026-10-10')?.id, 'current');
});

test('upcoming first invoice is available and empty history is safe', () => {
  assert.equal(newestInvoice([{ id: 'first', dueDate: '2026-10-11' }], '2026-10-10')?.id, 'first');
  assert.equal(newestInvoice([], '2026-10-10'), null);
});

test('payment before due date releases the first cycle', () => {
  assert.equal(newestInvoice([{ id: 'early', dueDate: '2026-10-12', status: 'CONFIRMED' }], '2026-10-10')?.status, 'CONFIRMED');
});

test('future paid invoice is recognized without concealing unpaid current invoice', () => {
  const early = { id: 'early', dueDate: '2026-11-01', status: 'RECEIVED' };
  assert.equal(newestInvoice([{ id: 'old', dueDate: '2026-10-01', status: 'RECEIVED' }, early], '2026-10-10')?.id, 'early');
  assert.equal(newestInvoice([{ id: 'current', dueDate: '2026-10-01', status: 'OVERDUE' }, early], '2026-10-10')?.id, 'current');
});