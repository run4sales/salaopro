import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('name search never adds an empty phone condition in source and deployed bundle', () => {
  for (const path of ['src/lib/mcp/tools/list-clients.ts', 'supabase/functions/mcp/index.ts']) {
    const source = read(path);
    const body = source.match(/const raw = search.trim\(\);([\s\S]*?)q = q.or\(filters.join\(","\)\);/)[1];
    const build = new Function('search', 'normalizePhone', `const raw = search.trim(); ${body}; return filters;`);
    const normalize = (s) => s.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
    assert.deepEqual(build('Maria', normalize), ['name.ilike.%Maria%', 'email.ilike.%Maria%']);
    assert.deepEqual(build('maria@example.com', normalize), ['name.ilike.%maria@example.com%', 'email.ilike.%maria@example.com%']);
    assert.ok(build('+55 (11) 98765-4321', normalize).includes('phone.ilike.%11987654321%'));
  }
});

test('company filter contains only distinct canonical effective states', () => {
  const shared = read('src/components/admin/shared.ts');
  const labels = new Function(`return ${shared.match(/STATUS_LABEL[^=]*= (\{[\s\S]*?\n\});/)[1]}`)();
  const values = new Function(`return ${shared.match(/EFFECTIVE_STATUS_OPTIONS = (\[[\s\S]*?\])/)[1]}`)();
  assert.equal(new Set(values.map((key) => labels[key])).size, values.length);
  assert.ok(values.includes('active_paid'));
  assert.ok(values.includes('trial_active'));
  assert.ok(values.includes('overdue'));
  for (const key of ['trial', 'active', 'past_due', 'pending', 'canceled']) assert.ok(!values.includes(key));
  assert.match(read('src/components/admin/AdminCompanies.tsx'), /EFFECTIVE_STATUS_OPTIONS.map/);
});