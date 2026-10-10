import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingSignupUrl, supportedLandingPlans } from '../src/lib/landingPlans.ts';

test('landing preserves only plan identifiers understood by signup', () => {
  for (const slug of ['individual', 'profissional', 'empresa']) {
    assert.equal(landingSignupUrl(slug), `/auth?tab=signup&plan=${slug}`);
  }
  assert.equal(landingSignupUrl('new-plan'), '/auth?tab=signup');
  assert.equal(landingSignupUrl(), '/auth?tab=signup');
  const plans = ['individual', 'new-plan', 'empresa'].map(slug => ({ slug }));
  assert.deepEqual(supportedLandingPlans(plans).map(p => p.slug), ['individual', 'empresa']);
});