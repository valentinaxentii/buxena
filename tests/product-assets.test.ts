/**
 * What may reach a customer, and what counts as ready. Run with:  npm test
 *
 * The expensive mistake here is one-directional: publishing a supplier's
 * drawing we were never given permission to use. `docs/image-rights-register.md`
 * exists because permission was once assumed instead of recorded, so the rule
 * is three independent conditions and every default refuses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSET_SLOTS,
  hasPublicAssets,
  isPubliclyAvailable,
  productReadiness,
  publicAssets,
  slotFor,
} from '../src/lib/product-assets.ts';

const verified = {
  status: 'VERIFIED' as const,
  permission: 'granted-written' as const,
  url: '/docs/plan.pdf',
};

test('publishing needs verified status, written permission AND a url', () => {
  const slot = slotFor('floorPlan')!;
  assert.equal(isPubliclyAvailable(verified, slot), true);

  assert.equal(isPubliclyAvailable({ ...verified, status: 'UNVERIFIED' }, slot), false, 'unverified');
  assert.equal(isPubliclyAvailable({ ...verified, status: 'REQUESTED' }, slot), false, 'requested is not held');
  assert.equal(isPubliclyAvailable({ ...verified, permission: 'pending' }, slot), false, 'permission pending');
  assert.equal(isPubliclyAvailable({ ...verified, permission: 'none' }, slot), false, 'no permission');
  assert.equal(isPubliclyAvailable({ ...verified, url: undefined }, slot), false, 'nothing to open');
  assert.equal(isPubliclyAvailable({ ...verified, url: '   ' }, slot), false, 'whitespace is not a url');
});

test('an INTERNAL_ONLY asset never becomes public, however complete', () => {
  const slot = slotFor('floorPlan')!;
  assert.equal(isPubliclyAvailable({ ...verified, status: 'INTERNAL_ONLY' }, slot), false);
});

test('internal slots have no public action even when fully verified', () => {
  // Packaging dimensions and unloading notes are operational. A customer has no
  // use for them and a supplier may not expect them published.
  for (const key of ['packagingDimensions', 'packagingPhotos', 'unloadingInstructions', 'imagePermission']) {
    const slot = slotFor(key)!;
    assert.equal(slot.action, undefined, `${key} must have no public action`);
    assert.equal(isPubliclyAvailable(verified, slot), false, key);
  }
});

test('a model with no assets shows nothing at all', () => {
  assert.deepEqual(publicAssets(undefined), []);
  assert.deepEqual(publicAssets({}), []);
  assert.equal(hasPublicAssets(undefined), false, 'no section, no empty tabs, no dead buttons');
});

test('public assets come back in ASSET_SLOTS order, not object order', () => {
  // The action row is ordered by persuasiveness; object key order is arbitrary.
  const assets = {
    warrantyDocument: { ...verified },
    installationVideo: { ...verified, provider: 'youtube' },
    floorPlan: { ...verified },
  };
  assert.deepEqual(
    publicAssets(assets).map((r) => r.slot.key),
    ['installationVideo', 'floorPlan', 'warrantyDocument']
  );
});

test('readiness is BLOCKED when nothing sales-critical is settled', () => {
  // The state the entire catalogue is in today. Calling it "partial" would
  // overstate how close we are.
  const r = productReadiness(undefined);
  assert.equal(r.verdict, 'BLOCKED');
  assert.ok(r.missingHighValue.length > 0);
  assert.equal(r.rows.length, ASSET_SLOTS.length, 'every slot is reported, not just the gaps');
  assert.ok(r.rows.every((row) => row.status === 'MISSING'));
});

test('REQUESTED does not count as settled — an unanswered email is not an asset', () => {
  const assets = Object.fromEntries(
    ASSET_SLOTS.filter((s) => s.weight === 'sales').map((s) => [s.key, { status: 'REQUESTED' as const }])
  );
  assert.equal(productReadiness(assets).verdict, 'BLOCKED');
});

test('NOT_APPLICABLE settles a slot — it is an answer, not a gap', () => {
  // An indoor model with no foundation requirement should not be chased for a
  // foundation guide forever.
  const assets = Object.fromEntries(
    ASSET_SLOTS.filter((s) => s.weight === 'sales').map((s) => [s.key, { status: 'NOT_APPLICABLE' as const }])
  );
  const r = productReadiness(assets);
  assert.equal(r.verdict, 'READY FOR SALES');
  assert.deepEqual(r.missingHighValue, []);
});

test('PARTIAL sits between the two, and names what is still missing', () => {
  const sales = ASSET_SLOTS.filter((s) => s.weight === 'sales');
  const assets: Record<string, { status: 'VERIFIED' | 'MISSING' }> = {};
  sales.forEach((s, i) => (assets[s.key] = { status: i === 0 ? 'VERIFIED' : 'MISSING' }));
  const r = productReadiness(assets);
  assert.equal(r.verdict, 'PARTIAL');
  assert.equal(r.missingHighValue.length, sales.length - 1);
  assert.equal(r.missingHighValue.some((s) => s.key === sales[0].key), false, 'the held one is not listed');
});

test('operational gaps alone do not block a sale', () => {
  // Unloading instructions matter for fulfilment, not for deciding to buy.
  const assets = Object.fromEntries(
    ASSET_SLOTS.filter((s) => s.weight === 'sales').map((s) => [s.key, { status: 'VERIFIED' as const }])
  );
  assert.equal(productReadiness(assets).verdict, 'READY FOR SALES');
});
