import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('src/pages/build-package.astro', 'utf8');
const band = fs.readFileSync('src/components/PackageBand.astro', 'utf8');

test('BUXENA Complete has one integrated package builder', () => {
  for (const label of ['Sauna', 'Heater system', 'Sauna stones', 'Lighting', 'Accessory set', 'Installation', 'Delivery ZIP']) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /rememberCommercialContext/);
  assert.match(page, /package: 'BUXENA Complete'/);
});

test('product page Complete package route preserves the current model', () => {
  assert.match(band, /id === 'complete'/);
  assert.match(band, /build-package\/\?model=/);
  assert.match(page, /searchParams/);
  assert.match(page, /initialModel/);
});

test('builder avoids invented live pricing and ordering claims', () => {
  assert.doesNotMatch(page, /\$\s*\d/);
  assert.match(page, /Nothing is ordered or charged/);
  assert.match(page, /Project pricing is confirmed/);
});
