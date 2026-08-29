import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const files = [
  path.join(root, 'private-data/supplier-pricing/sawo-accessories-2026-08.prices.json'),
  path.join(root, 'private-data/supplier-pricing/sawo-sauna_rooms-2026-08.prices.json'),
];

test('SAWO V3 private price seeds preserve the verified source counts and hashes', () => {
  const seeds = files.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  assert.equal(seeds[0].scope, 'accessories');
  assert.equal(seeds[0].row_count, 400);
  assert.equal(seeds[0].source_sha256, '0a02d5fb57d148e2418b87904b1f83f9acfc764baaf2d1f6d8050a01f322bc9a');
  assert.equal(seeds[1].scope, 'sauna_rooms');
  assert.equal(seeds[1].row_count, 240);
  assert.equal(seeds[1].source_sha256, '57d278b66f90907dc806f3de5d85063a33752edbea03cfb45ef435d760365dfb');
  assert.equal(seeds.reduce((sum, seed) => sum + seed.rows.length, 0), 640);
});

test('every seeded SAWO supplier price is positive and stored to cents', () => {
  for (const file of files) {
    const seed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const sourceRows = new Set<number>();
    for (const [sourceRow, sourceItem, material, unitCost] of seed.rows) {
      assert.ok(sourceItem, `${file} row ${sourceRow} must retain its source item`);
      assert.ok(Number(unitCost) > 0, `${file} row ${sourceRow} must have a positive price`);
      assert.match(String(unitCost), /^\d+\.\d{2}$/, `${file} row ${sourceRow} must preserve cents`);
      assert.ok(!sourceRows.has(sourceRow), `${file} duplicates source row ${sourceRow}`);
      sourceRows.add(sourceRow);
      void material;
    }
    assert.equal(sourceRows.size, seed.row_count);
  }
});
