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
