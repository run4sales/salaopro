import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('staff password validation is consistently six characters', () => {
  for (const path of ['src/pages/Users.tsx','src/components/users/EditUserDialog.tsx','supabase/functions/create-staff-user/index.ts','supabase/functions/update-staff-user/index.ts']) {
    const source = read(path);
    assert.match(source, /length < 6|minLength=\{6\}/, path);
    assert.doesNotMatch(source, /12 caracteres|length < 12|minLength=\{12\}/, path);
  }
});

test('staff creation never adopts a pre-existing auth identity and compensates failed writes', () => {
  const source = read('supabase/functions/create-staff-user/index.ts');
  assert.match(source, /EMAIL_EXISTS/);
  assert.doesNotMatch(source, /listUsers/);
  assert.match(source, /deleteUser\(userId\)/);
  assert.match(source, /MEMBERSHIP_CREATE_FAILED/);
});

test('comanda is seeded from per-service appointment price snapshots', () => {
  const source = read('src/lib/comanda.ts');
  assert.match(source, /appointment_services/);
  assert.match(source, /unit_price/);
  assert.match(source, /pricedServices\.map/);
  assert.doesNotMatch(source, /const unit_price = Number\(svc\?\.price/);
});

test('benefit migration provides tenant RLS and atomic idempotent consumption', () => {
  const source = read('supabase/migrations/20260827090000_service_benefits_and_price_snapshots.sql');
  for (const token of ['service_packages','customer_packages','customer_service_subscriptions','customer_subscription_cycles','service_benefit_consumptions','ENABLE ROW LEVEL SECURITY','FOR UPDATE OF c','service_benefit_one_active_consumption']) assert.ok(source.includes(token), token);
  assert.match(source, /status NOT IN \('scheduled','canceled'\)/);
  assert.match(source, /open_customer_subscription_cycle/);
});

test('Asaas webhook activates customer subscription cycles', () => {
  const source = read('supabase/functions/asaas-webhook/index.ts');
  assert.match(source, /customer_service_subscriptions/);
  assert.match(source, /open_customer_subscription_cycle/);
  assert.match(source, /past_due/);
});
