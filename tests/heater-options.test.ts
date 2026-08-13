/**
 * Reading heater facts back out of the catalogue. Run with:  npm test
 *
 * BUXENA holds no heater SKUs — `products.heater_options` is empty on every
 * row and no heater has an approved price — so the obvious brand/model/price
 * comparison grid could only be invented. What the catalogue DOES hold is
 * fifteen models' worth of verified, model-specific heater statements taken
 * from supplier sheets.
 *
 * The risk in parsing prose is over-reading it. These tests exist mostly to
 * pin what the parser must NOT conclude: silence is never "no", a mention of
 * wood inside a sentence excluding wood is not wood support, and a model with
 * no data is a gap in ours rather than a limitation of the sauna.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readHeaterFacts, heaterSummary, readHeaterInclusion } from '../src/lib/heater-options.ts';

// Verbatim from the catalogue, so these stay honest if the wording changes.
const ELLA_H2 = ['Electric 3.5–4.5 kW (confirmed range for this model — wood-burning not compatible)'];
const NORD_200 = ['HUUM 9 kW electric with Olivine Diabase stones (standard)', 'HUUM Wi-Fi app control available'];
const VIRU_GRAND = ['Harvia 9 kW electric with stones — included as standard', 'Harvia M2 wood-burning stove with chimney available'];
const VIRU_LINE = ['Electric: Harvia, HUUM (with app control)', 'Wood-burning: Harvia, Cozy, Narvi, HUUM HIVE Wood'];
const UKU = ['Heater-ready — electric or wood-fired options confirmed with your written quote'];

test('an exclusion sentence is not read as support', () => {
  // "wood-burning not compatible" MENTIONS wood in order to rule it out. A
  // naive keyword match would offer a wood stove for an indoor sauna.
  const f = readHeaterFacts(ELLA_H2);
  assert.deepEqual(f.fuels, ['electric']);
  assert.equal(f.woodExplicitlyIncompatible, true);
  assert.equal(f.kwRange, '3.5–4.5 kW');
});

test('stones and app control are recorded only when stated', () => {
  const nord = readHeaterFacts(NORD_200);
  assert.equal(nord.stonesIncluded, true);
  assert.equal(nord.appControl, true);
  assert.deepEqual(nord.brands, ['HUUM']);
  assert.equal(nord.heaterIncluded, true, '"(standard)" means a heater comes with it');

  // Silence must stay unknown — never false, which would read as "no stones".
  const ella = readHeaterFacts(ELLA_H2);
  assert.equal(ella.stonesIncluded, null);
  assert.equal(ella.appControl, null);
  assert.equal(ella.heaterIncluded, null);
});

test('both fuels are recognised where both are genuinely offered', () => {
  const grand = readHeaterFacts(VIRU_GRAND);
  assert.deepEqual(grand.fuels.sort(), ['electric', 'wood']);
  assert.equal(grand.heaterIncluded, true);
  assert.equal(grand.stonesIncluded, true);

  const line = readHeaterFacts(VIRU_LINE);
  assert.deepEqual(line.fuels.sort(), ['electric', 'wood']);
  assert.deepEqual([...line.brands].sort((a, b) => a.localeCompare(b)), ['Cozy', 'Harvia', 'HUUM', 'Narvi']);
  // No kW is stated for this line — it must not borrow one from elsewhere.
  assert.equal(line.kwRange, null);
});

test('a heater-ready model states both fuels without a heater included', () => {
  const uku = readHeaterFacts(UKU);
  assert.deepEqual(uku.fuels.sort(), ['electric', 'wood']);
  assert.equal(uku.heaterIncluded, null, 'heater-ready is not heater-included');
});

test('a model with no heater data is a gap in OUR data, not a limitation', () => {
  const none = readHeaterFacts([]);
  assert.equal(none.unknown, true);
  assert.deepEqual(none.fuels, []);
  assert.equal(none.kwRange, null);
  // The customer-facing line must never say "none" or "not available".
  assert.equal(heaterSummary(none), 'Confirmed with your quote');
  assert.equal(heaterSummary(readHeaterFacts(undefined)), 'Confirmed with your quote');
});

test('the original sentences are always preserved for display', () => {
  // A salesperson and a customer must be able to read the source wording
  // rather than trusting this parse.
  assert.deepEqual(readHeaterFacts(VIRU_LINE).statements, VIRU_LINE);
});

test('summaries read naturally and never overclaim', () => {
  assert.equal(heaterSummary(readHeaterFacts(ELLA_H2)), 'Electric · 3.5–4.5 kW');
  assert.match(heaterSummary(readHeaterFacts(NORD_200)), /Electric · 9 kW · heater included · app control/);
  // The VIRU line states 'HUUM (with app control)', so app control belongs
  // in the summary — asserting a bare fuel string was my error, not the code's.
  assert.equal(heaterSummary(readHeaterFacts(VIRU_LINE)), 'Electric or wood-burning · app control');
});

test('heater inclusion falls back to silence on anything unrecognised', () => {
  assert.equal(readHeaterInclusion('included'), 'included');
  assert.equal(readHeaterInclusion('optional'), 'optional');
  assert.equal(readHeaterInclusion('separate'), 'separate');
  assert.equal(readHeaterInclusion('not-selected'), 'not-selected');
  // Anything else renders nothing rather than a guess a customer could read
  // as a commitment.
  for (const bad of ['free', 'yes', '', null, undefined, 42]) {
    assert.equal(readHeaterInclusion(bad as unknown), 'unset');
  }
});
