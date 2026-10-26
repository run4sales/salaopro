import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAllPages } from '../src/lib/fetchAllPages.ts';

test('loads clients beyond the 1000-row API limit (2930 clients)', async () => {
  const all = Array.from({ length: 2930 }, (_, i) => i);
  const rows = await fetchAllPages(async (from, to) => all.slice(from, to + 1));
  assert.equal(rows.length, 2930);
  assert.equal(rows[2929], 2929);
});
test('errors propagate instead of showing a partial list', async () => {
  await assert.rejects(fetchAllPages(async () => { throw new Error('boom'); }), /boom/);
});
