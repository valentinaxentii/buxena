/**
 * The admin enquiry pages must never describe a database problem as a fact
 * about the business. Run with:  npm test
 *
 * The failure this guards is silent and it inverts the truth:
 *
 *   - the list read its data and dropped the error, so a failed query rendered
 *     as "No enquiries yet" — the funnel looks quiet while the CRM is dark;
 *   - the detail page treated ANY error as "Enquiry not found", so a timeout
 *     said the record never existed;
 *   - optional panels rendered empty when their query failed;
 *   - the pre-delete linkage check dropped its error, so an unreadable enquiry
 *     looked unlinked — the one direction where being wrong is irreversible.
 *
 * No database is touched here: the decisions are pure functions, which is the
 * only way these paths ever get exercised at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALREADY_CONVERTED_MESSAGES,
  campaignFacts,
  classifyList,
  classifyQueryError,
  classifyRow,
  contactedConfirmation,
  conversionConfirmation,
  conversionFailureMessage,
  decideEnquiryDeletion,
  findAnswer,
  statusChangeConfirmation,
} from '../src/lib/admin-enquiry-state.ts';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const LIST = read('pages/admin/enquiries/index.astro');
const DETAIL = read('pages/admin/enquiries/[id].astro');

// --------------------------------------------------------------- classification

test('an empty list is a successful result, not a failure', () => {
  const result = classifyList<{ id: string }>({ data: [], error: null });
  assert.equal(result.kind, 'ok', 'an empty database is a FACT and may be reported');
  assert.deepEqual(result.rows, []);
});

test('a null list with no error is still ok (defensive, never an error)', () => {
  assert.equal(classifyList({ data: null, error: null }).kind, 'ok');
});

test('a failed list query is unavailable, and returns no rows to render', () => {
  const result = classifyList({ data: null, error: { code: '57014', message: 'statement timeout' } });
  assert.equal(result.kind, 'unavailable');
  assert.deepEqual(result.rows, [], 'a failed read must not look like an empty one');
});

test('a missing table or column is a configuration problem, not a temporary one', () => {
  assert.equal(classifyQueryError({ code: '42P01' }), 'configuration', 'undefined table');
  assert.equal(classifyQueryError({ code: '42703' }), 'configuration', 'undefined column');
  assert.equal(classifyQueryError({ code: 'PGRST205' }), 'configuration', 'unknown relation');
});

test('anything else is an availability problem, so retrying is meaningful', () => {
  assert.equal(classifyQueryError({ code: '57014' }), 'unavailable');
  assert.equal(classifyQueryError({ code: 'PGRST301' }), 'unavailable');
  assert.equal(classifyQueryError(new Error('fetch failed')), 'unavailable');
  assert.equal(classifyQueryError(null), 'unavailable');
});

test('a single row read distinguishes present, absent and unreadable', () => {
  const row = { id: 'e1', status: 'New' };
  assert.equal(classifyRow({ data: row, error: null }).kind, 'ok');

  // The ONLY answer that proves absence: PostgREST's no-rows response.
  assert.equal(classifyRow({ data: null, error: { code: 'PGRST116' } }).kind, 'missing');
  assert.equal(classifyRow({ data: null, error: null }).kind, 'missing', 'maybeSingle with no row');

  // Everything else must NOT be reported as a missing record.
  assert.equal(classifyRow({ data: null, error: { code: '57014' } }).kind, 'unavailable');
  assert.equal(classifyRow({ data: null, error: { code: '42P01' } }).kind, 'configuration');
  assert.equal(classifyRow({ data: null, error: null }, false).kind, 'configuration', 'client could not be built');
});

test('a configured-but-unreachable database is not reported as unconfigured', () => {
  // The distinction the admin needs: "connect Supabase" vs "try again shortly".
  assert.equal(classifyRow({ data: null, error: { code: '57014' } }, true).kind, 'unavailable');
  assert.equal(classifyList({ data: null, error: { code: '57014' } }, true).kind, 'unavailable');
});

// ------------------------------------------------------------------- deletion

test('a linked enquiry is refused, with the lead/quote reason', () => {
  assert.equal(decideEnquiryDeletion({ data: { lead_id: 'l1' }, error: null }), 'blocked-linked');
  assert.equal(decideEnquiryDeletion({ data: { quote_id: 'q1' }, error: null }), 'blocked-linked');
});

test('an unlinked enquiry may be deleted', () => {
  assert.equal(decideEnquiryDeletion({ data: { lead_id: null, quote_id: null }, error: null }), 'allowed');
});

test('an UNVERIFIABLE linkage blocks deletion rather than allowing it', () => {
  // The regression that matters most: a failed lookup used to read as "not
  // linked", and the delete then removed a record that may have been the source
  // behind a Lead or a Quote.
  assert.equal(decideEnquiryDeletion({ data: null, error: { code: '57014' } }), 'blocked-unverified');
  assert.equal(decideEnquiryDeletion({ data: null, error: { code: 'PGRST116' } }), 'blocked-unverified');
  assert.equal(decideEnquiryDeletion({ data: null, error: null }), 'blocked-unverified');
  assert.equal(decideEnquiryDeletion({ data: { lead_id: null }, error: null }, false), 'blocked-unverified');
});

// -------------------------------------------------------- action confirmations

test('a status change is only believed when the re-read record agrees', () => {
  assert.equal(statusChangeConfirmation('Quoted', 'Quoted').tone, 'notice');

  const failed = statusChangeConfirmation('New', 'Quoted');
  assert.equal(failed.tone, 'error', 'a write that did nothing must not read as success');
  assert.match(failed.message, /did not take effect/);
  assert.match(failed.message, /"New"/, 'it says what the record actually reads');
});

test('an unknown status is never reported as a success', () => {
  assert.equal(statusChangeConfirmation(null, 'Quoted').tone, 'error');
  assert.equal(statusChangeConfirmation(undefined, 'Quoted').tone, 'error');
});

test('marking contacted is confirmed from contacted_at, not from the click', () => {
  assert.equal(contactedConfirmation('2026-09-14T10:00:00Z').tone, 'notice');
  assert.equal(contactedConfirmation(null).tone, 'error');
});

test('a conversion is confirmed from the linked id on the re-read row', () => {
  assert.equal(conversionConfirmation('lead', 'l1').tone, 'notice');
  assert.equal(conversionConfirmation('quote', 'q1').tone, 'notice');
  assert.equal(conversionConfirmation('lead', null).tone, 'error', 'a rolled-back conversion cannot read as success');
  assert.equal(conversionConfirmation('quote', undefined).tone, 'error');
});

test('a duplicate conversion is a notice that says no second record was made', () => {
  assert.match(ALREADY_CONVERTED_MESSAGES.lead, /no second Lead/);
  assert.match(ALREADY_CONVERTED_MESSAGES.quote, /no second Quote/);
});

test('conversion failures never leak the internal code into the message', () => {
  for (const reason of ['NOT_FOUND', 'QUOTE_CREATE_FAILED', 'SOMETHING_NEW']) {
    const message = conversionFailureMessage('quote', reason);
    assert.ok(message.length > 0);
    assert.ok(!message.includes(reason), `the raw code "${reason}" must not reach the UI`);
    assert.doesNotMatch(message, /created and linked/i);
  }
});

// ------------------------------------------------------- answers and campaign

test('the ZIP row reads the ZIP answer and never borrows another field', () => {
  const fields = [
    { label: 'ZIP', value: '06830' },
    { label: 'Total project budget', value: '$10,000 – $20,000' },
  ];
  assert.equal(findAnswer(fields, /^(zip|postal)/i), '06830');
  assert.equal(findAnswer(fields, /^people$/i), null, 'a missing answer is null, so the row shows — honestly');
});

test('a placement answer is not mistaken for a postal code', () => {
  // The exact historical bug: the quote form puts "outdoor" in `location`.
  const fields = [{ label: 'Placement', value: 'Outdoor' }];
  assert.equal(findAnswer(fields, /^(zip|postal)/i), null);
});

test('campaign facts are read back from the arrival timeline entry', () => {
  const description = 'Enquiry received — Quote Form | landing page: /quote/ · referrer: google.com · utm source: google';
  assert.deepEqual(campaignFacts([description]), [
    { label: 'Landing page', value: '/quote/' },
    { label: 'Referrer', value: 'google.com' },
    { label: 'UTM source', value: 'google' },
  ]);
});

test('only the permitted campaign fields are surfaced', () => {
  const description = 'Enquiry received — Quote Form | landing page: /quote/ · email: private@example.com · gclid: 123';
  assert.deepEqual(campaignFacts([description]).map((f) => f.label), ['Landing page'],
    'an allow-list, so arbitrary timeline text cannot become a fact');
});

test('a record with no attribution says so instead of inventing any', () => {
  assert.deepEqual(campaignFacts(['Enquiry received — Contact form']), []);
  assert.deepEqual(campaignFacts([]), []);
  assert.deepEqual(campaignFacts([null, undefined]), []);
});

test('diagnostic logs carry codes, never database messages or row ids', () => {
  const conversion = read('lib/enquiry-conversion.ts');
  const actions = read('lib/record-actions.ts');
  assert.ok(!/console\.error\([^)]*error\.message/.test(conversion), 'the activity log leaked the DB message');
  assert.ok(!/console\.error\(`[^`]*\$\{ctx\.id\}/.test(actions), 'the delete log carried the row id');
  assert.match(conversion, /code: error\.code \?\? 'unknown'/);
  assert.match(actions, /code: error\.code \?\? 'unknown'/);
});

// --------------------------------------------------------- structural guards

test('the list page cannot claim "no enquiries" unless the query succeeded', () => {
  assert.match(LIST, /classifyList\(/, 'the list result must be classified, not destructured');
  assert.match(LIST, /listKind === 'ok' && enquiries\.length === 0/, 'the empty message is gated on a successful read');
  assert.match(LIST, /LOAD_FAILED_BODY/, 'a failed read gets its own message');
  assert.match(LIST, /href=\{retryHref\}/, 'the failed read offers a retry');
  assert.ok(!/const \{ data \} = await query\.limit/.test(LIST), 'the query error must not be discarded again');
});

test('the detail page can only say "not found" for a genuine no-rows answer', () => {
  assert.match(DETAIL, /recordKind === 'missing'/, 'not-found is gated on the classified kind');
  assert.ok(!/let notFound/.test(DETAIL), 'the old any-error notFound flag is gone');
  assert.ok(!/if \(enquiryError \|\| !enquiryRow\)/.test(DETAIL), 'a query error must not mean "missing"');
});

test('the detail page blocks deletion on an unverifiable linkage', () => {
  assert.match(DETAIL, /decideEnquiryDeletion\(/, 'the delete path must use the guarded decision');
  assert.match(DETAIL, /deletion !== 'allowed'/, 'a blocked decision must skip the delete');
});

test('a failed action is confirmed from the record, and an unconfirmed one is admitted', () => {
  assert.match(DETAIL, /statusChangeConfirmation\(/);
  assert.match(DETAIL, /conversionConfirmation\(/);
  assert.match(DETAIL, /UNCONFIRMED_ACTION_MESSAGE/, 'an unreadable record admits it cannot confirm');
});

test('optional panels failing do not hide the record, and are named', () => {
  assert.match(DETAIL, /failedSections\.push\(/, 'each optional query records its own failure');
  assert.match(DETAIL, /sectionUnavailable\(section\)/, 'and each failure is named on screen');
  const notice = DETAIL.indexOf('failedSections.length > 0');
  const record = DETAIL.indexOf('class="enq-detail"');
  assert.ok(
    notice !== -1 && record !== -1 && notice < record,
    'the record renders alongside the warning, never instead of it'
  );
});

test('no raw database or exception message can reach the founder', () => {
  assert.ok(!/error = e instanceof Error \? e\.message/.test(DETAIL), 'the exception message was shown in the UI');
  assert.ok(!/Could not convert to Lead: ' \+ result\.reason/.test(DETAIL), 'the raw reason code was shown in the UI');
});
