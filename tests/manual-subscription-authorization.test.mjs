import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = p => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

test('manual decisions are atomic, dated, authorized and idempotent', async () => {
  const sql = await read('drizzle/migrations/0013_manual_subscription_authorization.sql');
  assert.match(sql, /has_role\(actor,'super_admin'\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /Informe a data de vencimento autorizada/);
  assert.match(sql, /manual_request_id=p_request_id/);
  assert.match(sql, /INSERT INTO public\.admin_actions_log/);
  assert.match(sql, /payment_source/);
  assert.doesNotMatch(sql, /UPDATE public\.subscription_payments/);
});

test('provider updates preserve authorization even when read before manual save', async () => {
  const sql = await read('drizzle/migrations/0013_manual_subscription_authorization.sql');
  assert.match(sql, /auth\.role\(\) = 'service_role'/);
  assert.match(sql, /NEW\.status := OLD\.status/);
  assert.match(sql, /NEW\.next_billing_at := OLD\.next_billing_at/);
  assert.match(sql, /NEW\.provider_next_billing_at := NEW\.next_billing_at/);
});

test('administrative active editing does not invent payment dates', async () => {
  const ui = await read('src/components/admin/AdminCompanies.tsx');
  assert.match(ui, /billingPaid \? 'paid' : 'grant'/);
  assert.match(ui, /Registrar pagamento recebido/);
  assert.doesNotMatch(ui, /updates\.last_payment_at = new Date/);
  assert.match(ui, /Retornar ao controle Asaas/);
});