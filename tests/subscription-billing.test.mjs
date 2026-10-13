import assert from 'node:assert/strict';
import test from 'node:test';
import { billingNotice, billingDaysLeft, subscriptionAccessNotice, hasValidManualAccess } from '../src/lib/subscriptionBilling.ts';

test('notice color follows the Brazil calendar boundaries', () => {
  const due = '2026-10-10';
  for (const [day, tone] of [['06', undefined], ['07', 'upcoming'], ['09', 'upcoming'], ['10', 'due'], ['11', 'late'], ['12', 'late'], ['13', 'late']]) {
    assert.equal(billingNotice(due, new Date(`2026-10-${day}T15:00:00Z`))?.tone, tone);
  }
});

test('the entire due day stays orange, including just before midnight', () => {
  assert.equal(billingNotice('2026-10-10', new Date('2026-10-11T02:59:59Z'))?.tone, 'due');
  assert.equal(billingDaysLeft('2026-10-10', new Date('2026-10-11T03:00:00Z')), -1);
});

test('no deadline means no invented invoice notice', () => {
  assert.equal(billingNotice(null), null);
});

test('Black Storm manual authorization suppresses old overdue invoice warnings', () => {
  const sub = { status: 'pending', manual_access_status: 'active', manual_access_due_date: '2027-03-27', current_invoice_status: 'OVERDUE', current_invoice_due_date: '2026-08-15' };
  assert.equal(hasValidManualAccess(sub, new Date('2026-10-13T15:00:00Z')), true);
  assert.equal(subscriptionAccessNotice(sub, new Date('2026-10-13T15:00:00Z')), null);
});

test('valid manual access hides debt notices through the entire authorized day', () => {
  const sub = { status: 'past_due', manual_access_status: 'active', manual_access_due_date: '2026-10-16', current_invoice_status: 'OVERDUE', current_invoice_due_date: '2026-08-15' };
  for (const now of ['2026-10-13T15:00:00Z', '2026-10-17T02:59:59Z']) assert.equal(subscriptionAccessNotice(sub, new Date(now)), null);
  const expired = subscriptionAccessNotice(sub, new Date('2026-10-17T03:00:00Z'));
  assert.equal(expired?.tone, 'late');
  assert.match(expired?.message ?? '', /prazo autorizado venceu/);
  assert.doesNotMatch(expired?.message ?? '', /fatura/);
});

test('automatic invoices still warn and explicit blocks are not valid manual access', () => {
  assert.equal(subscriptionAccessNotice({ status: 'active', current_invoice_status: 'OVERDUE', current_invoice_due_date: '2026-10-10' }, new Date('2026-10-13T15:00:00Z'))?.tone, 'late');
  assert.equal(hasValidManualAccess({ manual_access_status: 'active', manual_access_due_date: '2027-03-27', manual_blocked_at: '2026-10-13' }), false);
});