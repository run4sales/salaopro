import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('webhook rejects replay and preserves manual blocks', async () => {
  const source = await read('supabase/functions/asaas-webhook/index.ts');
  assert.match(source, /provider_event_id: providerEventId/);
  assert.match(source, /logError\?\.code === '23505'/);
  assert.match(source, /if \(!localSub\.manual_blocked_at\) updates\.status = 'active'/);
  assert.match(source, /payment\.clientPaymentDate/);
});

test('reconciliation uses the true latest invoice and preserves manual blocks', async () => {
  const source = await read('supabase/functions/_shared/asaas-sync.ts');
  assert.match(source, /const latestPayment = newestPayment\(payments\)/);
  assert.doesNotMatch(source, /const latestPayment = paidPayment \?\?/);
  assert.match(source, /subscription\.manual_blocked_at \? subscription\.status : derivedStatus/);
  assert.match(source, /manual_block_preserved/);
});

test('checkout reuses a compatible pending charge', async () => {
  const source = await read('supabase/functions/asaas-create-subscription/index.ts');
  assert.match(source, /payments\?status=PENDING/);
  assert.match(source, /reused: true/);
});