import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const seed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'private-data/competitor-pricing/bsaunas-2026-08-29.json'), 'utf8'));

test('BSaunas competitor baseline keeps markets and currencies separate', () => {
  assert.equal(seed.checked_on, '2026-08-29');
  assert.equal(seed.competitors.length, 2);
  const usa = seed.competitors.find((c: any) => c.name === 'BSaunas USA');
  const canada = seed.competitors.find((c: any) => c.name === 'Bsaunas Canada');
  assert.ok(usa);
  assert.ok(canada);
  assert.equal(usa.default_currency, 'USD');
  assert.equal(canada.default_currency, 'CAD');
  assert.equal(usa.observations.length, 15);
  assert.equal(canada.observations.length, 16);
  assert.match(usa.notes, /indexed/i);
  assert.match(canada.notes, /unable to ship to the United States/i);
});

test('every competitor observation retains a dated source and positive price', () => {
  const observations = seed.competitors.flatMap((competitor: any) => competitor.observations);
  assert.equal(observations.length, 31);
  for (const row of observations) {
    assert.ok(row.product_name);
    assert.ok(Number(row.price) > 0);
    assert.match(row.currency, /^[A-Z]{3}$/);
    assert.match(row.source_url, /^https:\/\//);
    if (row.compare_at_price != null) assert.ok(Number(row.compare_at_price) >= Number(row.price));
  }
});
