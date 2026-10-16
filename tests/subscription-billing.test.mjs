import assert from 'node:assert/strict';
import test from 'node:test';
import { billingNotice, billingDaysLeft, subscriptionAccessNotice, hasValidManualAccess, manualAuthorizationInEffect, subscriptionDeadline } from '../src/lib/subscriptionBilling.ts';

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
});

test('after the manual date passes, the real Asaas invoice drives the notice again', () => {
  const sub = { status: 'past_due', manual_access_status: 'active', manual_access_due_date: '2026-10-16', current_invoice_status: 'OVERDUE', current_invoice_due_date: '2026-08-15' };
  const expired = subscriptionAccessNotice(sub, new Date('2026-10-17T03:00:00Z'));
  assert.equal(expired?.tone, 'late');
  assert.match(expired?.message ?? '', /fatura/);
  assert.equal(manualAuthorizationInEffect(sub, new Date('2026-10-17T03:00:00Z')), false);
});

test('a salon that paid in Asaas after its manual date expired gets no warning', () => {
  const sub = { status: 'active', state: 'active_paid', manual_access_status: 'active', manual_access_due_date: '2026-10-01', current_invoice_status: 'RECEIVED', next_billing_at: '2026-10-01T15:00:00Z' };
  assert.equal(subscriptionAccessNotice(sub, new Date('2026-10-16T15:00:00Z')), null);
  assert.equal(subscriptionDeadline({ ...sub, next_billing_at: '2026-11-16' }, new Date('2026-10-16T15:00:00Z')), '2026-11-16');
});

test('an Asaas payment supersedes a manual pending state before its date', () => {
  const sub = { status: 'past_due', manual_access_status: 'past_due', manual_access_due_date: '2026-10-20', current_invoice_status: 'CONFIRMED' };
  assert.equal(manualAuthorizationInEffect(sub, new Date('2026-10-16T15:00:00Z')), false);
  assert.equal(manualAuthorizationInEffect({ ...sub, current_invoice_status: 'OVERDUE' }, new Date('2026-10-16T15:00:00Z')), true);
});

test('automatic invoices still warn and explicit blocks are not valid manual access', () => {
  assert.equal(subscriptionAccessNotice({ status: 'active', current_invoice_status: 'OVERDUE', current_invoice_due_date: '2026-10-10' }, new Date('2026-10-13T15:00:00Z'))?.tone, 'late');
  assert.equal(hasValidManualAccess({ manual_access_status: 'active', manual_access_due_date: '2027-03-27', manual_blocked_at: '2026-10-13' }), false);
});