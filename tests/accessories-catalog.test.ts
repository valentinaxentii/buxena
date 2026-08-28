import test from 'node:test';
import assert from 'node:assert/strict';
import { accessoryProducts } from '../src/data/accessories.ts';

test('curated accessory catalog has unique verified-looking SKUs', () => {
  assert.ok(accessoryProducts.length >= 10);
  const skus = accessoryProducts.map((p) => p.sku);
  assert.equal(new Set(skus).size, skus.length);
  for (const sku of skus) assert.match(sku, /^[A-Z0-9-]+$/);
});

test('catalog covers the commercial completion categories', () => {
  const categories = new Set(accessoryProducts.map((p) => p.category));
  for (const expected of ['sets', 'lighting', 'stones', 'wellness']) {
    assert.ok(categories.has(expected as any), `missing ${expected}`);
  }
});

test('public accessory data contains no supplier FCA pricing fields', () => {
  for (const product of accessoryProducts) {
    const record = product as unknown as Record<string, unknown>;
    assert.equal('price' in record, false);
    assert.equal('cost' in record, false);
    assert.equal('fca' in record, false);
  }
});
