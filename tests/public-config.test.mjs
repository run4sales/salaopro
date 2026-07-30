import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Supabase client has a public fallback when deploy environment variables are absent', async () => {
  const client = await read('src/integrations/supabase/client.ts');
  const fallback = await read('src/integrations/supabase/public-config.ts');

  assert.match(client, /VITE_SUPABASE_URL \?\? DEFAULT_SUPABASE_URL/);
  assert.match(client, /VITE_SUPABASE_PUBLISHABLE_KEY \?\? DEFAULT_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(fallback, /https:\/\/[^'\"]+\.supabase\.co/);
  assert.doesNotMatch(fallback, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});
