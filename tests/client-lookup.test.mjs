import assert from 'node:assert/strict';
import test from 'node:test';
import { loadClientNames } from '../src/lib/clientLookup.ts';

test('resolves referenced clients beyond 1000 without duplicates or unrelated clients', async () => {
  const ids = Array.from({ length: 1205 }, (_, i) => `client-${i}`);
  const batches = [];
  const result = await loadClientNames([...ids, ids[0], null, undefined], async batch => {
    batches.push(batch);
    return batch.map(id => ({ id, name: `Name ${id}` }));
  });
  assert.equal(result.length, 1205);
  assert.equal(result[1204].name, 'Name client-1204');
  assert.deepEqual(batches.map(batch => batch.length), [200, 200, 200, 200, 200, 200, 5]);
  assert.deepEqual(batches.flat(), ids);
});
test('empty list does not query', async () => {
  assert.deepEqual(await loadClientNames([], async () => { throw new Error('unexpected request'); }), []);
});
test('lookup errors propagate instead of silently hiding names', async () => {
  await assert.rejects(loadClientNames(['client-1'], async () => { throw new Error('lookup failed'); }), /lookup failed/);
});