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

test('options appear as a single-select variant group when the model states them', () => {
  const groups = buildConfigGroups({
    title: 'BUH-VIRU',
    options: ['Flat-pack kit', 'Factory assembled'],
  });
  const variants = groups.find((g) => g.key === 'variants');
  assert.ok(variants, 'variant group should exist');
  assert.equal(variants!.fromProductData, true);
  assert.equal(variants!.multiSelect, undefined, 'variants are mutually exclusive, never multi-select');
  assert.deepEqual(variants!.options.map((o) => o.label), ['Flat-pack kit', 'Factory assembled']);
});

test('independent accessories are separated from mutually-exclusive variants', () => {
  const groups = buildConfigGroups({
    title: 'BUX EDA 160',
    options: [
      'Full glass front',
      'Half-moon rear glass',
      'Exterior finish: Natural / Main Parts Painted / Fully Painted',
      'LED lighting kit (Wi-Fi switch optional)',
    ],
  });
  const variants = groups.find((g) => g.key === 'variants')!;
  const accessories = groups.find((g) => g.key === 'accessories')!;
  assert.ok(variants, 'variant group exists');
  assert.ok(accessories, 'accessories group exists');
  assert.equal(accessories.multiSelect, true, 'accessories are multi-select');
  assert.deepEqual(accessories.options.map((o) => o.label), ['LED lighting kit (Wi-Fi switch optional)']);
  assert.deepEqual(variants.options.map((o) => o.label), [
    'Full glass front',
    'Half-moon rear glass',
    'Exterior finish: Natural / Main Parts Painted / Fully Painted',
  ]);
  assert.ok(
    !variants.options.some((o) => o.label === 'LED lighting kit (Wi-Fi switch optional)'),
    'an accessory must never reach the variant group'
  );
});

test('all four verified accessory values are recognised as accessories', () => {
  const groups = buildConfigGroups({
    title: 'X',
    options: ['Ergonomic backrest', 'Backrest', 'Bench skirts', 'LED lighting kit (Wi-Fi switch optional)'],
  });
  const accessories = groups.find((g) => g.key === 'accessories')!;
  assert.ok(accessories, 'accessories group exists');
  assert.equal(accessories.multiSelect, true);
  assert.equal(accessories.options.length, 4);
  assert.equal(groups.find((g) => g.key === 'variants'), undefined, 'a model with only accessories has no variant group');
});

test('a model with no accessories has no accessories group', () => {
  const groups = buildConfigGroups({ title: 'BUH-VIRU', options: ['Flat-pack kit', 'Factory assembled'] });
  assert.equal(groups.find((g) => g.key === 'accessories'), undefined);
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
  const lines = summariseSelections(groups, { variants: 'Factory assembled', heater: 'Electric' });
  assert.deepEqual(lines, ['Options: Factory assembled', 'Heater: Electric']);
  // An unanswered group is omitted — a blank is not a selection, and padding
  // the note with "not selected" makes it harder for staff to read.
  const partial = summariseSelections(groups, { variants: 'Flat-pack kit' });
  assert.deepEqual(partial, ['Options: Flat-pack kit']);
});

test('an unknown selection falls back to its raw value rather than vanishing', () => {
  // Defensive: a stale value from an older page version must still reach staff.
  const groups = buildConfigGroups({ title: 'X', heaterOptions: ['Electric: Harvia'] });
  const lines = summariseSelections(groups, { heater: 'LEGACY_VALUE' });
  assert.deepEqual(lines, ['Heater: LEGACY_VALUE']);
});
