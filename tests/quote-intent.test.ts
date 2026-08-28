import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('pricing page visibly confirms carried package intent', () => {
  const page = read('src/pages/quote.astro');
  const banner = read('src/components/QuoteIntentBanner.astro');
  assert.match(page, /QuoteIntentBanner/);
  assert.match(banner, /searchParams/);
  assert.match(banner, /params\.get\('package'\)/);
  assert.match(banner, /We will carry this into your pricing request/);
});

test('package, heater and accessory CTAs all use the same package query vocabulary', () => {
  const packageBand = read('src/components/PackageBand.astro');
  const heaters = read('src/pages/heaters.astro');
  const accessories = read('src/pages/accessories.astro');
  assert.match(packageBand, /&package=/);
  assert.match(heaters, /\/quote\/\?package=/);
  assert.match(accessories, /\/quote\/\?package=/);
});
