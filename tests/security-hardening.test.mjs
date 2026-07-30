import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Asaas webhook fails closed and limits untrusted requests', async () => {
  const source = await read('supabase/functions/asaas-webhook/index.ts');

  assert.match(source, /if \(!expected\)/, 'a missing webhook secret must reject requests');
  assert.match(source, /tokensMatch\(expected, received\)/, 'the supplied token must be verified');
  assert.match(source, /req\.method !== 'POST'/, 'non-POST requests must be rejected');
  assert.match(source, /MAX_BODY_BYTES/, 'request bodies must have a bounded size');
  assert.match(source, /SUPPORTED_EVENTS\.has\(event\)/, 'unknown events must be rejected');
  assert.doesNotMatch(source, /if \(expected && received !== expected\)/, 'authentication must not fail open');
});

test('signup does not invoke CRM write endpoints from the browser', async () => {
  const sources = await Promise.all([
    read('src/hooks/useAuth.tsx'),
    read('src/pages/Auth.tsx'),
    read('src/integrations/supabase/client.ts'),
  ]);

  for (const source of sources) {
    assert.doesNotMatch(source, /agendor-(?:create|submit|sync)-signup-lead/);
  }

  const config = await read('supabase/config.toml');
  assert.match(
    config,
    /\[functions\.agendor-create-signup-lead\]\s+verify_jwt = true/,
    'legacy CRM endpoint must require a valid JWT',
  );
});

test('Asaas deliveries are idempotent and logs contain only allowlisted fields', async () => {
  const source = await read('supabase/functions/asaas-webhook/index.ts');
  const migration = await read('supabase/migrations/20260730090000_harden_asaas_webhook_idempotency.sql');

  assert.match(source, /provider_event_id: providerEventId/);
  assert.match(source, /ignoreDuplicates: true/);
  assert.match(source, /duplicate: true/);
  assert.match(source, /payload: safePayload/);
  assert.match(source, /raw: sanitizedPayment\(payment\)/);
  assert.match(source, /delete\(\)\.eq\('id', logId\)\.eq\('processed', false\)/);
  assert.doesNotMatch(source, /payload,\s*\n/);
  assert.match(migration, /UNIQUE INDEX[\s\S]+provider_event_id/i);
});

test('staff administration validates roles, stronger passwords, origins, methods and body size', async () => {
  const sources = await Promise.all([
    read('supabase/functions/create-staff-user/index.ts'),
    read('supabase/functions/update-staff-user/index.ts'),
  ]);
  const cors = await read('supabase/functions/_shared/cors.ts');

  for (const source of sources) {
    assert.match(source, /ALLOWED_ROLES/);
    assert.match(source, /length < 12/);
    assert.match(source, /req\.method !== "POST"/);
    assert.match(source, /MAX_BODY_BYTES/);
    assert.match(source, /isAllowedBrowserOrigin/);
    assert.doesNotMatch(source, /Access-Control-Allow-Origin": "\*"/);
  }
  assert.match(cors, /ALLOWED_ORIGINS/);
  assert.match(cors, /Vary': 'Origin'/);
});

test('client page does not print customer records to the browser console', async () => {
  const source = await read('src/pages/Clients.tsx');
  assert.doesNotMatch(source, /console\.log/);
});

test('production build validates the required public Supabase configuration', async () => {
  const validator = await read('scripts/validate-public-env.mjs');
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(packageJson.scripts.prebuild, 'node scripts/validate-public-env.mjs');
  assert.match(validator, /VITE_SUPABASE_URL/);
  assert.match(validator, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(validator, /VITE_SUPABASE_PROJECT_ID/);
  assert.doesNotMatch(validator, /console\.log\([^)]*values/);
});
