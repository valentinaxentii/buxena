/**
 * Keeping the form's identity when the database will not store it.
 * Run with:  npm test
 *
 * Verified against the live database on 2026-08-13: `enquiries.source` admits
 * five values, the site sends twelve, and nine are rejected outright. Those
 * nine reached the inbox but never became a record anybody could assign or
 * chase. Until the migration is applied the API retries with an accepted
 * source and writes the true form into the message; these tests pin the two
 * halves of that — the fallback fires ONLY for this constraint, and the real
 * form always reads back.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FALLBACK_SOURCE,
  effectiveSource,
  isSourceConstraintError,
  withFormLine,
} from '../src/lib/enquiry-source.ts';

test('the true form reads back from the message', () => {
  const message = withFormLine('Boutique hotel project.', 'For Trade');
  assert.equal(effectiveSource({ source: FALLBACK_SOURCE, message }), 'For Trade');
});

test('the original message survives the added line', () => {
  const message = withFormLine('Boutique hotel project.', 'For Trade');
  assert.ok(message.includes('Boutique hotel project.'));
  assert.ok(message.startsWith('Form: For Trade'));
});

test('an empty message still carries the form', () => {
  assert.equal(effectiveSource({ source: 'Website', message: withFormLine(null, 'Warranty Claim') }), 'Warranty Claim');
});

test('without a Form line the column is the answer', () => {
  // The three sources that always fitted, and every source once migrated.
  assert.equal(effectiveSource({ source: 'Quote Form', message: 'Pricing request' }), 'Quote Form');
  assert.equal(effectiveSource({ source: 'Sauna Advisor', message: null }), 'Sauna Advisor');
});

test('a customer writing the word Form does not hijack the source', () => {
  // Only a line that STARTS with `Form:` counts, so prose mentioning it is safe.
  const message = 'I filled in your Form: it was easy';
  assert.equal(effectiveSource({ source: 'Quote Form', message }), 'Quote Form');
});

test('missing and malformed input never throws', () => {
  assert.equal(effectiveSource(null), '');
  assert.equal(effectiveSource(undefined), '');
  assert.equal(effectiveSource({}), '');
  assert.equal(withFormLine(null, null), '');
  assert.equal(withFormLine('x', ''), 'x');
});

test('only the source constraint triggers the fallback', () => {
  assert.equal(
    isSourceConstraintError({ message: 'new row violates check constraint "enquiries_source_check"' }),
    true
  );
  // Anything else must fall through to the notification path rather than be
  // silently rewritten — a rewritten insert would hide a real defect.
  assert.equal(isSourceConstraintError({ message: 'duplicate key value violates unique constraint' }), false);
  assert.equal(isSourceConstraintError({ message: 'permission denied for table enquiries' }), false);
  assert.equal(isSourceConstraintError({ message: 'violates check constraint "enquiries_status_check"' }), false);
  assert.equal(isSourceConstraintError(null), false);
  assert.equal(isSourceConstraintError(undefined), false);
});

test('the fallback source is one the un-migrated column accepts', () => {
  assert.equal(FALLBACK_SOURCE, 'Website');
});
