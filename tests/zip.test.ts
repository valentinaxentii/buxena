/**
 * U.S. ZIP code validation. Run with:  npm test
 *
 * The bug: 012545 was accepted. Six digits, and it reached the enquiry — which
 * means a quote priced against a delivery zone that does not exist.
 *
 * Two causes, both covered here and in the source. The pattern in use was
 * `\d{5}(-\d{4})?`, which is correct for five digits but was attached to
 * fields the browser never validated: two of the seven ZIP inputs live in
 * multi-step wizards that are not inside a submitting <form>, so `pattern` was
 * decorative. And the admin customer form had no pattern at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZIP_MESSAGE,
  ZIP_REGEX,
  checkOptionalZip,
  isValidUsZip,
  normalizeZip,
} from '../src/lib/zip.ts';

test('accepts the required examples', () => {
  for (const zip of ['06410', '10001', '90210']) {
    assert.equal(isValidUsZip(zip), true, `${zip} must be accepted`);
  }
});

test('rejects the required examples', () => {
  // Every one of these was accepted somewhere before this change.
  assert.equal(isValidUsZip('012545'), false, 'six digits — the reported bug');
  assert.equal(isValidUsZip('1234'), false, 'four digits');
  assert.equal(isValidUsZip('123456'), false, 'six digits');
  assert.equal(isValidUsZip('12A45'), false, 'contains a letter');
});

test('leading zeroes are preserved, not treated as smaller numbers', () => {
  // 06410 is Cheshire, Connecticut — BUXENA's own state. A field that drops
  // the leading zero turns it into 6410, which is not a ZIP code at all. This
  // is why the inputs are type="text" with inputmode="numeric", never
  // type="number".
  assert.equal(isValidUsZip('06410'), true);
  assert.equal(isValidUsZip('00501'), true, 'lowest real ZIP, Holtsville NY');
  assert.equal(isValidUsZip('6410'), false, 'the same value with its zero lost');
  assert.equal(normalizeZip('06410'), '06410', 'normalizing never alters digits');
});

test('rejects letters, spaces and punctuation inside the value', () => {
  for (const bad of ['1234A', 'ABCDE', '12 45', '12-45', '12.45', '1234!', '＋1234']) {
    assert.equal(isValidUsZip(bad), false, `${bad} must be rejected`);
  }
});

test('ZIP+4 is no longer accepted', () => {
  // Previously allowed by `\d{5}(-\d{4})?`. Nothing downstream uses the +4,
  // and the requirement is a plain five digits, so the looser rule only
  // widened what could arrive.
  assert.equal(isValidUsZip('06410-1234'), false);
});

test('surrounding whitespace is tolerated, inner whitespace is not', () => {
  // Leading/trailing space is nearly always a paste artefact, not something
  // anyone typed deliberately.
  assert.equal(isValidUsZip('  06410  '), true);
  assert.equal(isValidUsZip('064 10'), false);
});

test('non-strings never pass', () => {
  // A JSON body can carry anything; the server must not trust the shape.
  for (const bad of [null, undefined, 6410, 6410.0, {}, [], true, NaN]) {
    assert.equal(isValidUsZip(bad), false, `${String(bad)} must be rejected`);
  }
});

test('the regex is anchored so it cannot match inside a longer string', () => {
  assert.equal(ZIP_REGEX.test('x06410'), false);
  assert.equal(ZIP_REGEX.test('06410x'), false);
  assert.equal(ZIP_REGEX.test('06410\n'), false, 'a trailing newline must not slip past $');
});

test('the optional-field check treats blank as unanswered, not as wrong', () => {
  // Most of these fields are optional. "Not answered" and "answered wrongly"
  // are different, and only the second deserves an error.
  assert.deepEqual(checkOptionalZip(''), { ok: true });
  assert.deepEqual(checkOptionalZip('   '), { ok: true });
  assert.deepEqual(checkOptionalZip(null), { ok: true });
  assert.deepEqual(checkOptionalZip(undefined), { ok: true });
  assert.deepEqual(checkOptionalZip('06410'), { ok: true });
});

test('the optional-field check rejects a present-but-invalid value', () => {
  const result = checkOptionalZip('012545');
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.message, ZIP_MESSAGE);
});

test('the customer-facing message is the one specified', () => {
  assert.equal(ZIP_MESSAGE, 'Enter a valid 5-digit U.S. ZIP code.');
});
