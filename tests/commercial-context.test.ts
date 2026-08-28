import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const client = fs.readFileSync('src/lib/enquiry-client.ts', 'utf8');
const layout = fs.readFileSync('src/layouts/BaseLayout.astro', 'utf8');

test('commercial context is session-only and cleared after successful capture', () => {
  assert.match(client, /sessionStorage\.setItem\(COMMERCIAL_CONTEXT_KEY/);
  assert.match(client, /clearCommercialContext\(\)/);
  assert.doesNotMatch(client, /localStorage\.setItem\(COMMERCIAL_CONTEXT_KEY/);
});

test('product configurator choices are synchronized into commercial context', () => {
  assert.match(layout, /rememberCommercialContext/);
  assert.match(layout, /\[data-cfg-input\]:checked/);
  assert.match(layout, /\[data-cfg-zip\]/);
});

test('exact-quote path does not duplicate configuration in the CRM message', () => {
  assert.match(client, /messageAlreadyHasConfiguration/);
  assert.match(client, /Configured on the product page:/);
  assert.match(client, /messageAlreadyHasConfiguration \? '' : commercialContextBlock/);
});
