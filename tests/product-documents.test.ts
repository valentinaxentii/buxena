/**
 * What may appear in a product's public Documents section. Run with: npm test
 *
 * The risk is one-directional and expensive: publishing a dealer price list on
 * a product page hands a competitor BUXENA's cost base, and cannot be undone
 * once it is indexed. So the rule is an ALLOWLIST — anything not explicitly
 * recognised as customer-safe is withheld — with a blocklist behind it as a
 * second, independent reason to refuse.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customerSafeDocuments,
  hasCustomerDocuments,
  isCustomerSafeDocument,
} from '../src/lib/product-documents.ts';

test('customer literature is publishable', () => {
  for (const label of [
    'Floor plan',
    'Dimensions drawing',
    'Installation manual',
    'User manual',
    'Electrical guide',
    'Foundation requirements',
    'Heater manual',
    'Warranty',
    'Maintenance guide',
    'Specification sheet',
    'Model Presentation',
  ]) {
    assert.equal(isCustomerSafeDocument({ label, file: '/x.pdf' }), true, label);
  }
});

test('commercial documents are never publishable', () => {
  for (const label of [
    'Dealer price list',
    'Supplier pricing 2026',
    'Landed cost sheet',
    'EXW cost breakdown',
    'Margin analysis',
    'Internal notes',
    'Distribution agreement',
    'Purchase order 4471',
    'Invoice INV-2026-0001',
  ]) {
    assert.equal(isCustomerSafeDocument({ label, file: '/x.pdf' }), false, label);
  }
});

test('the blocklist overrides an otherwise safe-looking label', () => {
  // "Warranty" is on the allowlist; "dealer" must still veto it. Two
  // independent reasons to withhold, so one being wrong is not enough to leak.
  assert.equal(isCustomerSafeDocument({ label: 'Dealer warranty terms', file: '/x.pdf' }), false);
  assert.equal(isCustomerSafeDocument({ label: 'Installation manual — internal', file: '/x.pdf' }), false);
});

test('an unrecognised label is withheld, not published', () => {
  // The allowlist fails CLOSED. A blocklist would publish anything it had
  // never heard of — including next year's cost document.
  assert.equal(isCustomerSafeDocument({ label: 'Q3 planning notes', file: '/x.pdf' }), false);
  assert.equal(isCustomerSafeDocument({ label: '', file: '/x.pdf' }), false);
});

test('a document with no file is dropped rather than rendered as a dead link', () => {
  const docs = [
    { label: 'Installation manual' },              // recorded, nothing to link
    { label: 'Floor plan', file: '/docs/plan.pdf' },
  ];
  assert.deepEqual(customerSafeDocuments(docs).map((d) => d.label), ['Floor plan']);
});

test('the section stays hidden unless something real can be shown', () => {
  assert.equal(hasCustomerDocuments([]), false, 'no documents at all');
  assert.equal(hasCustomerDocuments(undefined), false);
  assert.equal(
    hasCustomerDocuments([{ label: 'Dealer price list', file: '/secret.pdf' }]),
    false,
    'a model whose only document is commercial shows no section'
  );
  assert.equal(hasCustomerDocuments([{ label: 'Floor plan', file: '/p.pdf' }]), true);
});
