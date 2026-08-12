/**
 * Pure unit tests for the invoice-numbering format helpers — no database.
 * Run with:  npm test
 * (Node 22+ strips the TypeScript types natively. The script passes a glob,
 * not the bare `tests/` directory — Node 24 tries to load a directory
 * argument as a module and fails before any test runs.)
 *
 * The database-side behavior (gapless counter, locking, rollback) lives in
 * the plpgsql function `issue_document_number` and is covered by
 * scripts/test-invoice-numbering-db.mjs, which can only run AFTER the
 * schema migration has been applied to the database.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDocumentNumber,
  documentScopeFor,
  sequenceYearFor,
} from '../src/lib/invoice-number.ts';

test('scope mapping: invoice -> INV, proforma -> PRO', () => {
  assert.equal(documentScopeFor('invoice'), 'INV');
  assert.equal(documentScopeFor('proforma'), 'PRO');
});

test('sequential formatting pads to 4 digits', () => {
  assert.equal(formatDocumentNumber('INV', 2026, 1), 'INV-2026-0001');
  assert.equal(formatDocumentNumber('INV', 2026, 2), 'INV-2026-0002');
  assert.equal(formatDocumentNumber('INV', 2026, 42), 'INV-2026-0042');
  assert.equal(formatDocumentNumber('INV', 2026, 9999), 'INV-2026-9999');
});

test('counter grows past 9999 without wrapping or truncating', () => {
  assert.equal(formatDocumentNumber('INV', 2026, 10000), 'INV-2026-10000');
});

test('proforma uses its own prefix', () => {
  assert.equal(formatDocumentNumber('PRO', 2026, 1), 'PRO-2026-0001');
});

test('year rollover: sequence year follows issue_date, else today', () => {
  const today = new Date('2026-07-25T12:00:00Z');
  assert.equal(sequenceYearFor('2025-12-31', today), 2025);
  assert.equal(sequenceYearFor('2026-01-01', today), 2026);
  assert.equal(sequenceYearFor(null, today), 2026);
  assert.equal(sequenceYearFor(undefined, today), 2026);
  // a new year means a fresh sequence under the same scope
  assert.equal(formatDocumentNumber('INV', 2027, 1), 'INV-2027-0001');
});

test('invalid inputs throw instead of producing a malformed number', () => {
  assert.throws(() => formatDocumentNumber('INV', 26, 1));
  assert.throws(() => formatDocumentNumber('INV', 2026, 0));
  assert.throws(() => formatDocumentNumber('INV', 2026, -1));
  assert.throws(() => formatDocumentNumber('INV', 2026, 1.5));
});
