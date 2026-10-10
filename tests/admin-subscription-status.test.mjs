import assert from 'node:assert/strict';
import test from 'node:test';
import { adminSubscriptionStatus } from '../src/lib/adminSubscriptionStatus.ts';

const now = new Date('2026-10-21T15:00:00Z');
test('expired trial remains expired at ten days and canceled after ten days', () => {
  assert.equal(adminSubscriptionStatus({ status: 'trial', trial_ends_at: '2026-10-11T03:00:00Z' }, 'trial_expired', now), 'trial_expired');
  assert.equal(adminSubscriptionStatus({ status: 'trial', trial_ends_at: '2026-10-10T03:00:00Z' }, 'trial_expired', now), 'canceled');
});
test('billing cancellation counts from third overdue day, not due day', () => {
  assert.equal(adminSubscriptionStatus({ status: 'past_due', current_invoice_due_date: '2026-10-08' }, 'overdue', now), 'overdue');
  assert.equal(adminSubscriptionStatus({ status: 'past_due', current_invoice_due_date: '2026-10-07' }, 'overdue', now), 'canceled');
});
test('manual block uses its own date; missing evidence is not invented', () => {
  assert.equal(adminSubscriptionStatus({ status: 'blocked', manual_blocked_at: '2026-10-10T03:00:00Z' }, 'blocked_manual', now), 'canceled');
  assert.equal(adminSubscriptionStatus({ status: 'blocked' }, 'blocked_manual', now), 'blocked_manual');
});
test('paid or grace access is not canceled by an old invoice; explicit cancellation is preserved', () => {
  for (const state of ['active_paid', 'grace_active', 'payment_pending', 'trial_active']) {
    assert.equal(adminSubscriptionStatus({ status: 'active', current_invoice_due_date: '2020-01-01' }, state, now), state);
  }
  assert.equal(adminSubscriptionStatus({ status: 'canceled' }, 'blocked', now), 'canceled');
});
test('classification follows Brazil calendar and does not mutate input', () => {
  const sub = { status: 'trial', trial_ends_at: '2026-10-10T03:00:00Z' };
  assert.equal(adminSubscriptionStatus(sub, 'trial_expired', new Date('2026-10-21T02:59:59Z')), 'trial_expired');
  assert.equal(adminSubscriptionStatus(sub, 'trial_expired', new Date('2026-10-21T03:00:00Z')), 'canceled');
  assert.equal(sub.status, 'trial');
});