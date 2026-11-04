import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../supabase/functions/create-staff-user/index.ts', import.meta.url), 'utf8');
const executable = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

async function createStaff(schedule) {
  let handler;
  const inserts = {};
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'owner' } } }),
      admin: { createUser: async () => ({ data: { user: { id: 'new-user' } } }) },
    },
    from(table) {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: { id: 'salon' } }),
        insert: value => { inserts[table] = value; return query; },
        single: async () => ({ data: { id: 'professional' } }),
        upsert: async value => { inserts[table] = value; return {}; },
      };
      return query;
    },
  };
  vm.runInNewContext(executable, {
    Deno: { env: { get: () => 'test-only' }, serve: fn => { handler = fn; } },
    createClient: () => client,
    corsHeaders: () => ({}), isAllowedBrowserOrigin: () => true,
    validateEmail: () => ({ valid: true, normalized: 'test@example.com' }),
    staffCommissionPatch: () => ({}),
    Request, Response, TextEncoder, console,
  });
  const response = await handler(new Request('http://localhost/create-staff-user', {
    method: 'POST', headers: { Authorization: 'Bearer test-only' },
    body: JSON.stringify({ establishment_id: 'salon', email: 'test@example.com', password: 'Test-only-123', name: 'Test', role: 'admin', ...schedule }),
  }));
  return { response, inserts };
}

test('turning schedule participation off saves an inactive professional without disabling login', async () => {
  const { response, inserts } = await createStaff({ on_agenda: false });
  assert.equal(response.status, 200);
  assert.equal(inserts.professionals.active, false);
  assert.equal(inserts.establishment_users.active, true);
  assert.equal(inserts.establishment_users.professional_id, 'professional');
});

test('turning schedule participation on saves a bookable professional', async () => {
  const { response, inserts } = await createStaff({ on_agenda: true });
  assert.equal(response.status, 200);
  assert.equal(inserts.professionals.active, true);
});

test('legacy callers without a schedule option remain bookable', async () => {
  const { response, inserts } = await createStaff({});
  assert.equal(response.status, 200);
  assert.equal(inserts.professionals.active, true);
});

test('non-boolean schedule options are rejected before any profile is created', async () => {
  const { response, inserts } = await createStaff({ on_agenda: 'false' });
  assert.equal(response.status, 400);
  assert.equal(Object.keys(inserts).length, 0);
});