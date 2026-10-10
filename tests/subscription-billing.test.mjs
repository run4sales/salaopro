import assert from 'node:assert/strict';
import test from 'node:test';
import { billingNotice, billingDaysLeft } from '../src/lib/subscriptionBilling.ts';

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