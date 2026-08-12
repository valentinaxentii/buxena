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
  hasProductOptions,
  summariseSelections,
} from '../src/lib/product-config.ts';

test('a model with no verified options exposes no product groups', () => {
  const groups = buildConfigGroups({ title: 'BUH-TEST' });
  assert.equal(hasProductOptions({ title: 'BUH-TEST' }), false);
  assert.deepEqual(
    groups.filter((g) => g.fromProductData),
    [],
    'nothing may be invented for a model with no data'
  );
  // The preference question is still safe to ask: it is about the customer,
  // not a claim about the product.
  assert.deepEqual(groups.map((g) => g.key), ['installation']);
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

test('installation is offered on every model and marked as a preference', () => {
  for (const model of [{ title: 'A' }, { title: 'B', options: ['Flat-pack kit'] }]) {
    const install = buildConfigGroups(model).find((g) => g.key === 'installation');
    assert.ok(install, 'installation must always be offered');
    assert.equal(install!.fromProductData, false, 'it is a customer preference, not a product claim');
  }
});

test('the summary lists only answered groups, in page order', () => {
  const groups = buildConfigGroups({
    title: 'BUH-VIRU',
    options: ['Flat-pack kit', 'Factory assembled'],
    heaterOptions: ['Electric: Harvia'],
  });
  const lines = summariseSelections(groups, { supply: 'Factory assembled', installation: 'DIY' });
  assert.deepEqual(lines, [
    'Supply format: Factory assembled',
    'Installation: I will install it myself',
  ]);
  // Heater was not answered — a blank is not a selection, and padding the note
  // with "not selected" makes it harder for staff to read what was chosen.
  assert.equal(lines.some((l) => l.startsWith('Heater')), false);
});

test('the summary resolves labels, never raw values', () => {
  const groups = buildConfigGroups({ title: 'X' });
  const lines = summariseSelections(groups, { installation: 'THIRD_PARTY' });
  assert.deepEqual(lines, ['Installation: My own contractor']);
});

test('an unknown selection falls back to its raw value rather than vanishing', () => {
  // Defensive: a stale value from an older page version must still reach staff.
  const groups = buildConfigGroups({ title: 'X' });
  const lines = summariseSelections(groups, { installation: 'LEGACY_VALUE' });
  assert.deepEqual(lines, ['Installation: LEGACY_VALUE']);
});
