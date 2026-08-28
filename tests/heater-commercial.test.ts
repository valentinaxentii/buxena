import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { heaterSystemLines } from '../src/data/heater-systems.ts';

test('heater merchandising is limited to the verified Homecraft lines', () => {
  assert.deepEqual(
    heaterSystemLines.map((h) => h.line),
    ['H-Series', 'Revive', 'Revive Slim', 'Apex Mini', 'Apex']
  );
  assert.ok(heaterSystemLines.every((h) => h.brand === 'Homecraft'));
});

test('heater merchandising does not publish unapproved prices or certification claims', () => {
  const source = fs.readFileSync('src/data/heater-systems.ts', 'utf8');
  assert.doesNotMatch(source, /\$\s*\d/);
  assert.doesNotMatch(source, /UL\/CSA certified|UL certified|CSA certified/i);
  assert.match(source, /confirmed in the written quote/i);
});

test('heater page carries product-line intent into the existing quote funnel', () => {
  const page = fs.readFileSync('src/pages/heaters.astro', 'utf8');
  assert.match(page, /\/quote\/\?package=/);
  assert.match(page, /Heater system interest:/);
  assert.match(page, /BUXENA Complete/);
});

test('product package section exposes both heater and accessory merchandising', () => {
  const band = fs.readFileSync('src/components/PackageBand.astro', 'utf8');
  assert.match(band, /href="\/heaters\/"/);
  assert.match(band, /href="\/accessories\/"/);
});
