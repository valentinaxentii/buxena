import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('package cards preserve model and package intent across both buying paths', () => {
  const source = fs.readFileSync(new URL('../src/components/PackageBand.astro', import.meta.url), 'utf8');
  // Sauna/Project go directly to pricing with model + package.
  assert.match(source, /`\/quote\/\?model=\$\{encodeURIComponent\(model\)\}&package=\$\{encodeURIComponent\(name\)\}`/);
  // Complete preserves the current model but goes through the integrated builder first.
  assert.match(source, /`\/build-package\/\?model=\$\{encodeURIComponent\(model\)\}`/);
  assert.match(source, /Configure Complete Package/);
  assert.match(source, /Build This Package/);
});

test('accessory cards carry SKU and name into the existing quote package intent', () => {
  const source = fs.readFileSync(new URL('../src/pages/accessories.astro', import.meta.url), 'utf8');
  assert.match(source, /package=\$\{encodeURIComponent\(`Accessory: \$\{product\.sku\} — \$\{product\.name\}`\)\}/);
  assert.match(source, />Add to My Quote</);
});
