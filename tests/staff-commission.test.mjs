import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStaffCommission, staffCommissionPatch } from '../supabase/functions/_shared/staff-commission.ts';
import { staffCommissionValue } from '../src/lib/staffCommission.ts';

test('staff percentage is persisted in the configuration used by commission calculations', () => {
  assert.deepEqual(staffCommissionPatch('35.5'), {
    commission_percentage: 35.5, commission_type: 'custom_percentage', custom_percentage: 35.5,
  });
});

test('zero commission is valid and never replaced with a default', () => {
  assert.equal(staffCommissionPatch('0').custom_percentage, 0);
});

test('omitted commission leaves existing settings untouched', () => {
  assert.deepEqual(staffCommissionPatch(undefined), {});
  const existing = { commission_type: 'fixed_daily', daily_amount: 150, custom_percentage: 25 };
  assert.deepEqual({ ...existing, ...staffCommissionPatch(undefined) }, existing);
});

test('editing reads the actual custom percentage, not the obsolete standard value', () => {
  assert.equal(staffCommissionValue({ commission_type: 'custom_percentage', custom_percentage: 35.5, commission_percentage: 40 }), 35.5);
});

test('invalid percentages are rejected before saving', () => {
  for (const value of ['', -1, 101, 'invalid', null, true, Infinity]) {
    assert.throws(() => parseStaffCommission(value), /comissão/);
  }
  assert.equal(parseStaffCommission('35,5'), 35.5);
  assert.equal(parseStaffCommission(100), 100);
});