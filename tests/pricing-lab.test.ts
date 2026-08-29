import assert from 'node:assert/strict';
import test from 'node:test';
import { grossMarginPct, marketBand, markupPct, retailForMargin } from '../src/lib/pricing-lab';

test('retailForMargin solves retail from landed cost and gross margin', () => {
  assert.equal(retailForMargin(5000, 50), 10000);
  assert.equal(retailForMargin(5500, 45), 10000);
  assert.equal(retailForMargin(0, 45), null);
  assert.equal(retailForMargin(5000, 100), null);
});

test('gross margin and markup stay distinct', () => {
  assert.equal(grossMarginPct(5000, 10000), 50);
  assert.equal(markupPct(5000, 10000), 100);
});

test('marketBand never mixes currencies', () => {
  const rows = [
    { currency: 'USD', price: 6500, observed_on: '2026-08-20' },
    { currency: 'USD', price: 7900, observed_on: '2026-08-29' },
    { currency: 'CAD', price: 1800, observed_on: '2026-08-29' },
  ];
  assert.deepEqual(marketBand(rows, 'USD'), { low: 6500, high: 7900, count: 2, latest: '2026-08-29' });
  assert.deepEqual(marketBand(rows, 'CAD'), { low: 1800, high: 1800, count: 1, latest: '2026-08-29' });
});
