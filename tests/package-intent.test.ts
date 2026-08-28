import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('package cards preserve model and package in quote URL', () => {
  const source = fs.readFileSync(new URL('../src/components/PackageBand.astro', import.meta.url), 'utf8');
  assert.match(source, /\/quote\/\?model=\$\{encodeURIComponent\(model\)\}&package=\$\{encodeURIComponent\(pkg\.name\)\}/);
  assert.match(source, />Build This Package</);
});

test('accessory cards carry SKU and name into the existing quote package intent', () => {
  const source = fs.readFileSync(new URL('../src/pages/accessories.astro', import.meta.url), 'utf8');
  assert.match(source, /package=\$\{encodeURIComponent\(`Accessory: \$\{product\.sku\} — \$\{product\.name\}`\)\}/);
  assert.match(source, />Add to My Quote</);
});
