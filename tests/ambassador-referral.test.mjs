import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReferralCode, readStoredReferral, REFERRAL_TTL_MS } from '../src/lib/ambassadorReferral.ts';
test('normalizes valid codes but rejects malformed codes', () => {
  assert.equal(normalizeReferralCode(' Maria-01 '), 'maria-01');
  assert.equal(normalizeReferralCode('../../admin'), null);
  assert.equal(normalizeReferralCode('ab'), null);
});
test('referral expires after thirty days without extending on read', () => {
  assert.equal(REFERRAL_TTL_MS, 2592000000);
  const saved = JSON.stringify({ code: 'maria', expiresAt: 2592001000 });
  assert.equal(readStoredReferral(saved, 2592000999), 'maria');
  assert.equal(readStoredReferral(saved, 2592001000), null);
  assert.equal(readStoredReferral('{', 0), null);
});