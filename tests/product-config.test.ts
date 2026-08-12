/**
 * The product configurator's option groups. Run with:  npm test
 *
 * The rule these protect: an option a customer can select is a promise BUXENA
 * has to keep. 32 of 35 models have no verified dealer data behind them, so a
 * configurator that invents a wood choice or a heater type to fill out the
 * layout produces leads asking for things that may not exist.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConfigGroups,
  classifyModel,
  hasProductOptions,
  INSTALLATION_PREFERENCES,
  shouldShowConfigurator,
  summariseSelections,
} from '../src/lib/product-config.ts';

test('a model with no verified options exposes no groups at all', () => {
  const model = { title: 'BUH-TEST' };
  assert.deepEqual(buildConfigGroups(model), [], 'nothing may be invented for a model with no data');
  assert.equal(hasProductOptions(model), false);
  assert.equal(shouldShowConfigurator(model), false, 'the whole configurator is hidden');
});

test('supply format appears only when the model states it', () => {
  const groups = buildConfigGroups({
    title: 'BUH-VIRU',
    options: ['Flat-pack kit', 'Factory assembled'],
  });
  const supply = groups.find((g) => g.key === 'supply');
  assert.ok(supply, 'supply group should exist');
  assert.equal(supply!.fromProductData, true);
  assert.deepEqual(supply!.options.map((o) => o.label), ['Flat-pack kit', 'Factory assembled']);
});

test('heater families are split from their verified brands', () => {
  // Frontmatter writes "Electric: Harvia, HUUM (with app control)". The family
  // is the choice; the brands are detail the specialist confirms.
  const groups = buildConfigGroups({
    title: 'BUH-VIRU',
    heaterOptions: [
      'Electric: Harvia, HUUM (with app control)',
      'Wood-burning: Harvia, Cozy, Narvi, HUUM HIVE Wood',
    ],
  });
  const heater = groups.find((g) => g.key === 'heater');
  assert.ok(heater);
  assert.deepEqual(heater!.options.map((o) => o.label), ['Electric', 'Wood-burning']);
  assert.match(heater!.options[0].hint!, /Harvia, HUUM/);
  assert.match(heater!.options[0].hint!, /Verified for this model/);
});

test('a heater entry with no colon is kept whole', () => {
  const groups = buildConfigGroups({ title: 'X', heaterOptions: ['Electric only'] });
  const heater = groups.find((g) => g.key === 'heater')!;
  assert.equal(heater.options[0].label, 'Electric only');
  assert.equal(heater.options[0].hint, undefined);
});

test('a single material is a fact, not a choice', () => {
  // Offering a one-item "choose your exterior" group implies an alternative
  // exists. It does not.
  const one = buildConfigGroups({ title: 'X', materials: ['Thermowood'] });
  assert.equal(one.find((g) => g.key === 'material'), undefined);

  const two = buildConfigGroups({ title: 'X', materials: ['Thermowood', 'Nordic Spruce'] });
  assert.ok(two.find((g) => g.key === 'material'));
});

test('installation is NOT a configurator group — it lives in the quote form', () => {
  // A configurator whose single question is "how will you install it?" performs
  // configurability while asking nothing about the product. Installation is a
  // customer preference and is asked once, in the quote form, for every model.
  for (const model of [{ title: 'A' }, { title: 'B', options: ['Flat-pack kit'] }]) {
    assert.equal(buildConfigGroups(model).some((g) => g.key === 'installation'), false);
  }
  assert.equal(INSTALLATION_PREFERENCES.length, 4);
  assert.deepEqual(
    INSTALLATION_PREFERENCES.map((o) => o.value),
    ['DIY', 'BUXENA', 'THIRD_PARTY', 'UNDECIDED'],
    'values match the admin installation_type vocabulary'
  );
});

test('a model with verified options shows the configurator', () => {
  assert.equal(shouldShowConfigurator({ title: 'X', options: ['Flat-pack kit', 'Assembled'] }), true);
  assert.equal(shouldShowConfigurator({ title: 'X', heaterOptions: ['Electric: Harvia'] }), true);
});

test('classification separates a real quote-only model from a data gap', () => {
  const bare = { title: 'EDA-1' };
  const richPeer = { title: 'EDA-2', heaterOptions: ['Electric: Harvia'] };
  // No peer has options -> genuinely nothing to configure.
  assert.equal(classifyModel(bare, [bare]), 'quote-only');
  // A sibling in the same series HAS verified options, so this is a missing
  // record, not a product fact — a task with a supplier's name on it.
  assert.equal(classifyModel(bare, [bare, richPeer]), 'blocked-data');
  assert.equal(classifyModel(richPeer, [bare, richPeer]), 'configurable');
});

test('the summary lists only answered groups, in page order', () => {
  const groups = buildConfigGroups({
    title: 'BUH-VIRU',
    options: ['Flat-pack kit', 'Factory assembled'],
    heaterOptions: ['Electric: Harvia'],
  });
  const lines = summariseSelections(groups, { supply: 'Factory assembled', heater: 'Electric' });
  assert.deepEqual(lines, ['Supply format: Factory assembled', 'Heater: Electric']);
  // An unanswered group is omitted — a blank is not a selection, and padding
  // the note with "not selected" makes it harder for staff to read.
  const partial = summariseSelections(groups, { supply: 'Flat-pack kit' });
  assert.deepEqual(partial, ['Supply format: Flat-pack kit']);
});

test('an unknown selection falls back to its raw value rather than vanishing', () => {
  // Defensive: a stale value from an older page version must still reach staff.
  const groups = buildConfigGroups({ title: 'X', heaterOptions: ['Electric: Harvia'] });
  const lines = summariseSelections(groups, { heater: 'LEGACY_VALUE' });
  assert.deepEqual(lines, ['Heater: LEGACY_VALUE']);
});
