import test from 'node:test';
import assert from 'node:assert/strict';
import { clearNavigation, isNavigationDate, isNavigationId, navigationChoice, navigationScope, readNavigation, safeNavigationRoute, writeNavigation } from '../src/lib/navigationPersistence.ts';
import { isTemporaryAuthError, needsAccessContext } from '../src/lib/authContinuity.ts';

class Storage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test('same-user focus/renewal does not reload access context', () => {
  assert.equal(needsAccessContext('user-a', 'user-a'), false);
  assert.equal(needsAccessContext(null, 'user-a'), true);
  assert.equal(needsAccessContext('user-a', 'user-b'), true);
});
test('network outages are retryable, revoked credentials are not', () => {
  assert.equal(isTemporaryAuthError({ name: 'AuthRetryableFetchError', status: 503 }), true);
  assert.equal(isTemporaryAuthError(new TypeError('Failed to fetch')), true);
  assert.equal(isTemporaryAuthError({ status: 401, message: 'Invalid refresh token' }), false);
});
test('agenda route survives reopening with permitted query parameters only', () => {
  assert.equal(safeNavigationRoute('/clients?filter=inactive&email=private&token=secret#access_token=secret', 'owner'), '/clients?filter=inactive');
});
test('employee cannot restore financial or administrative routes', () => {
  assert.equal(safeNavigationRoute('/reports', 'employee'), null);
  assert.equal(safeNavigationRoute('/admin', 'employee'), null);
  assert.equal(safeNavigationRoute('/agenda', 'employee'), '/agenda');
});
test('unknown, external, auth and callback paths are never restored', () => {
  for (const route of ['//evil.test', '/\\evil.test', 'https://evil.test', '/auth', '/~oauth', '/missing', '/agendar/salon']) {
    assert.equal(safeNavigationRoute(route, 'owner'), null);
  }
  assert.equal(safeNavigationRoute('/agenda', null), null);
});
test('navigation selections are isolated by both account and salon', () => {
  const storage = new Storage();
  writeNavigation(storage, navigationScope('a', 'salon-1'), 'route', '/agenda');
  const valid = value => typeof value === 'string';
  assert.equal(readNavigation(storage, navigationScope('a', 'salon-1'), 'route', null, valid), '/agenda');
  assert.equal(readNavigation(storage, navigationScope('b', 'salon-1'), 'route', null, valid), null);
  assert.equal(readNavigation(storage, navigationScope('a', 'salon-2'), 'route', null, valid), null);
});
test('logout clears previous-account navigation without touching provider credentials or other accounts', () => {
  const storage = new Storage();
  writeNavigation(storage, navigationScope('a', '1'), 'route', '/clients');
  writeNavigation(storage, navigationScope('a', '2'), 'tab', 'financial');
  writeNavigation(storage, navigationScope('b', '1'), 'route', '/agenda');
  storage.setItem('provider-session', 'untouched');
  storage.setItem('agenda.professionalFilter', 'legacy');
  clearNavigation(storage, 'a');
  assert.equal(storage.getItem(navigationScope('a', '1') + 'route'), null);
  assert.equal(storage.getItem(navigationScope('a', '2') + 'tab'), null);
  assert.equal(storage.getItem(navigationScope('b', '1') + 'route'), '"/agenda"');
  assert.equal(storage.getItem('provider-session'), 'untouched');
  assert.equal(storage.getItem('agenda.professionalFilter'), null);
});
test('client profile stores only its identifier and restores allowed tabs', () => {
  assert.equal(isNavigationId('d4e57172-bd91-49d3-9639-6b8feb3fa453'), true);
  assert.equal(isNavigationId({ id: 'd4e57172-bd91-49d3-9639-6b8feb3fa453', name: 'Private' }), false);
  assert.equal(navigationChoice('history', 'financial')('financial'), true);
  assert.equal(navigationChoice('history', 'financial')('admin'), false);
});
test('agenda and report dates survive persistence and invalid values fall back', () => {
  const storage = new Storage();
  const scope = navigationScope('a', '1');
  writeNavigation(storage, scope, 'agenda.date', '2027-03-15T12:00:00.000Z');
  assert.equal(readNavigation(storage, scope, 'agenda.date', '2026-11-12', isNavigationDate), '2027-03-15T12:00:00.000Z');
  writeNavigation(storage, scope, 'agenda.date', 'not-a-date');
  assert.equal(readNavigation(storage, scope, 'agenda.date', '2026-11-12', isNavigationDate), '2026-11-12');
});
test('malformed and unavailable storage does not crash navigation', () => {
  const storage = new Storage();
  storage.setItem('scope:key', '{invalid');
  assert.equal(readNavigation(storage, 'scope:', 'key', 'week', navigationChoice('week')), 'week');
  const unavailable = { getItem() { throw Error('disabled'); }, setItem() { throw Error('disabled'); } };
  assert.equal(readNavigation(unavailable, 'scope:', 'key', 'week', navigationChoice('week')), 'week');
  assert.doesNotThrow(() => writeNavigation(unavailable, 'scope:', 'key', 'week'));
});