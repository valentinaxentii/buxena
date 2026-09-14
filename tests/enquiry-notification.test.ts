/**
 * The staff notification must describe where an enquiry came from without
 * inventing facts. Run with:  npm test
 *
 * `enquiries.location` holds a ZIP for most forms (quote, consultation,
 * start-your-project, availability) and a project location for trade enquiries.
 * Both notifications printed it under one heading, "ZIP / Location", so a
 * submission carrying ZIP 06830 beside the placement answer "Outdoor" told the
 * salesperson "ZIP / Location: Outdoor" — no deliverable ZIP to check delivery
 * against, and a room placement presented as a postcode.
 *
 * The decision is a pure function so both channels cannot disagree, and the
 * email body is a pure builder so the exact text is asserted with no transport
 * in sight.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contactLocationRows } from '../src/lib/enquiry-location.ts';
import { buildEnquiryNotification } from '../src/lib/send-enquiry-email.ts';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const value = (rows: { label: string; value: string }[], label: string) =>
  rows.find((row) => row.label === label)?.value;

// ---------------------------------------------------------- location labelling

test('the reported case: the ZIP is a ZIP and Outdoor is a placement', () => {
  const rows = contactLocationRows('06830', 'Outdoor');
  assert.equal(rows.length, 2);
  assert.equal(value(rows, 'ZIP / Postal Code'), '06830');
  assert.equal(value(rows, 'Placement / Location'), 'Outdoor');
});

test('the same ZIP in both fields is not repeated as a placement', () => {
  // The quote form sends `location: zip` and `zip: zip` — one fact, one row.
  assert.deepEqual(contactLocationRows('06830', '06830'), [{ label: 'ZIP / Postal Code', value: '06830' }]);
});

test('a bare ZIP still reports as a ZIP', () => {
  assert.deepEqual(contactLocationRows('06410', null), [{ label: 'ZIP / Postal Code', value: '06410' }]);
  assert.deepEqual(contactLocationRows('06410', ''), [{ label: 'ZIP / Postal Code', value: '06410' }]);
});

test('older formats are preserved: a ZIP stored in location still reads as one', () => {
  assert.deepEqual(contactLocationRows(null, '06830'), [{ label: 'ZIP / Postal Code', value: '06830' }]);
  assert.deepEqual(contactLocationRows(undefined, '06410'), [{ label: 'ZIP / Postal Code', value: '06410' }]);
});

test('a genuine location is never labelled a postcode', () => {
  const rows = contactLocationRows(null, 'Hartford, CT');
  assert.deepEqual(rows, [{ label: 'Placement / Location', value: 'Hartford, CT' }]);
  assert.equal(value(rows, 'ZIP / Postal Code'), undefined);
});

test('nothing given keeps the row visible with an em dash', () => {
  assert.deepEqual(contactLocationRows(null, null), [{ label: 'ZIP / Postal Code', value: '—' }]);
});

test('padding never decides which label a value gets', () => {
  assert.deepEqual(contactLocationRows('  06830  ', '   '), [{ label: 'ZIP / Postal Code', value: '06830' }]);
  assert.deepEqual(contactLocationRows(null, ' 06830 '), [{ label: 'ZIP / Postal Code', value: '06830' }]);
});

// ------------------------------------------------------------ the email itself

test('the notification email carries both rows, ZIP first', () => {
  const { text, subject } = buildEnquiryNotification({
    name: 'Valentin Axentii',
    email: 'v@example.com',
    phone: '203',
    zip: '06830',
    location: 'Outdoor',
    saunaInterest: 'BUH-ELLA H2',
    source: 'Quote Form',
    message: 'Pricing request\n\nZIP: 06830 · Total project budget: $10,000 – $20,000',
  });
  assert.equal(subject, 'New enquiry — Valentin Axentii');
  assert.match(text, /^ZIP \/ Postal Code: 06830$/m);
  assert.match(text, /^Placement \/ Location: Outdoor$/m);
  assert.ok(!/ZIP \/ Location/.test(text), 'the merged label must be gone');
  assert.ok(!/^ZIP \/ Postal Code: Outdoor$/m.test(text), 'a placement must never read as the postcode');
  assert.ok(
    text.indexOf('ZIP / Postal Code') < text.indexOf('Placement / Location'),
    'the postcode is the first thing a salesperson needs'
  );
});

test('the notification keeps the customer words and the admin claim', () => {
  const { text } = buildEnquiryNotification({ name: 'A', email: 'a@b.co', message: 'hello there', source: 'Contact' });
  assert.match(text, /Message:\nhello there/);
  assert.match(text, /saved in BUXENA Admin → Website Enquiries/);
  assert.ok(!/only copy/.test(text));
});

test('an unrecorded enquiry says the email is the only copy', () => {
  const { text, html } = buildEnquiryNotification({ name: 'A', email: 'a@b.co', message: 'x', unrecorded: true });
  assert.match(text, /only copy/);
  assert.match(html, /only copy/);
});

test('hostile input cannot inject markup into the email', () => {
  const { html } = buildEnquiryNotification({
    name: '<img src=x onerror=alert(1)>',
    message: 'R&D <3',
    source: 'Contact',
  });
  assert.ok(!html.includes('<img src=x'), 'an unescaped tag reached the email body');
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /R&amp;D/);
});

// ------------------------------------------------------------------- wiring

test('both notification channels use the one location decision', () => {
  assert.match(read('lib/send-enquiry-email.ts'), /contactLocationRows\(input\.zip, input\.location\)/);
  assert.match(read('lib/notify-telegram.ts'), /contactLocationRows\(input\.zip, input\.location\)/);
  assert.ok(!/'ZIP \/ Location'/.test(read('lib/send-enquiry-email.ts')), 'the email still merges the two');
  assert.ok(!/'ZIP \/ Location'/.test(read('lib/notify-telegram.ts')), 'the Telegram message still merges the two');
});

test('the API carries the customer ZIP through to both notifications', () => {
  const api = read('pages/api/enquiries.ts');
  assert.match(api, /normalizeZip\(zip\)/, 'the ZIP must be carried through');
  assert.match(api, /zip: zipValue/, 'and attached to the notification payload');
});
