import assert from 'node:assert/strict';
import test from 'node:test';
import { billingCountdown, formatBillingDate, subscriptionDeadline } from '../src/lib/subscriptionBilling.ts';

test('countdown distinguishes upcoming, due and overdue dates', () => {
  const now = new Date('2026-10-10T17:41:00Z');
  assert.equal(billingCountdown('2026-10-13', now), 'Faltam 3 dias');
  assert.equal(billingCountdown('2026-10-11', now), 'Faltam 1 dia');
  assert.equal(billingCountdown('2026-10-10', now), 'Vence hoje');
  assert.equal(billingCountdown('2026-10-09', now), 'Vencido há 1 dia');
  assert.equal(billingCountdown(null, now), 'Sem vencimento informado');
});

test('deadline prefers unpaid invoice, next cycle after payment, or trial end', () => {
  const sub = { status: 'active', current_invoice_status: 'PENDING', current_invoice_due_date: '2026-10-10', next_billing_at: '2026-11-10' };
  assert.equal(subscriptionDeadline(sub), '2026-10-10');
  assert.equal(subscriptionDeadline({ ...sub, current_invoice_status: 'RECEIVED' }), '2026-11-10');
  assert.equal(subscriptionDeadline({ ...sub, status: 'trial', trial_ends_at: '2026-10-15' }), '2026-10-15');
  assert.equal(subscriptionDeadline(undefined), null);
});

test('payment dates retain calendar dates and Brazil timestamp boundaries', () => {
  assert.equal(formatBillingDate('2026-10-10'), '10/10/2026');
  assert.equal(formatBillingDate('2026-10-11T02:59:00Z'), '10/10/2026');
  assert.equal(formatBillingDate(null), '—');
});

test('manual access deadline wins without falsifying the overdue provider invoice', () => {
  const sub = { status: 'active', manual_access_due_date: '2027-03-31', current_invoice_status: 'OVERDUE', current_invoice_due_date: '2026-08-15', next_billing_at: '2027-03-31' };
  assert.equal(subscriptionDeadline(sub), '2027-03-31');
  assert.equal(sub.current_invoice_status, 'OVERDUE');
  assert.equal(sub.current_invoice_due_date, '2026-08-15');
  assert.equal(subscriptionDeadline({ ...sub, manual_access_due_date: null }), '2026-08-15');
});