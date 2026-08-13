/**
 * Embedding JSON inside a <script> element. Run with:  npm test
 *
 * The bug: `set:html={JSON.stringify(customers)}` on Admin → Invoices → New.
 * JSON.stringify does not escape `<` or `/`, so a stored value containing
 * `</script>` closed the tag and the rest was parsed as markup.
 *
 * It was reachable from the public site. A visitor types a name into any
 * enquiry form; convertEnquiryToLead copies it to leads.name and
 * createQuoteFromEnquiry copies it to customers.name; a staff member opens the
 * new-invoice page and the payload runs in their session. Stored XSS in the
 * admin panel, authored from an anonymous public form.
 *
 * These tests pin the two properties that matter together: the output can no
 * longer break out of a script element, AND it still parses back to exactly
 * the value that went in. An escaper that corrupts data is its own outage —
 * the first attempt at this table escaped every space, because U+2028 is
 * invisible and had been transcribed as one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonForScript } from '../src/lib/json-script.ts';

const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

test('a closing script tag cannot survive into the document', () => {
  const hostile = [{ id: '1', name: '</script><script>alert(1)</script>' }];
  const out = jsonForScript(hostile);
  assert.ok(!/<\/script/i.test(out), 'output must not contain a literal </script');
  assert.ok(!out.includes('<'), 'no raw < may reach the page');
  assert.ok(!out.includes('>'), 'no raw > may reach the page');
});

test('& is escaped too, so no entity can be smuggled in', () => {
  assert.ok(!jsonForScript({ a: 'x & y' }).includes('&'));
});

test('the Unicode line terminators are escaped', () => {
  const out = jsonForScript({ a: `x${LINE_SEP}y${PARA_SEP}z` });
  assert.ok(!out.includes(LINE_SEP), 'U+2028 must not survive');
  assert.ok(!out.includes(PARA_SEP), 'U+2029 must not survive');
});

test('ordinary text is left completely alone', () => {
  // The regression that matters most: an escape table with a mis-transcribed
  // U+2028 key silently rewrites every space in every payload.
  const plain = { name: 'Jane Doe', note: 'a normal sentence, with punctuation.' };
  const out = jsonForScript(plain);
  assert.ok(out.includes('Jane Doe'), 'spaces must be preserved verbatim');
  assert.equal(out, JSON.stringify(plain), 'nothing to escape means byte-identical output');
});

test('the value round-trips exactly', () => {
  const original = [
    { id: '1', name: '</script>', nested: { deep: 'a & b' } },
    { id: '2', name: `line${LINE_SEP}break`, n: 42, ok: true, nil: null },
  ];
  assert.deepEqual(JSON.parse(jsonForScript(original)), original);
});

test('the output is always parseable JSON', () => {
  for (const value of [null, undefined, 0, '', false, [], {}, 'plain']) {
    assert.doesNotThrow(() => JSON.parse(jsonForScript(value)), `failed for ${String(value)}`);
  }
  // undefined has no JSON representation; it must not emit the bare token
  // `undefined`, which would throw at parse time in the browser.
  assert.equal(jsonForScript(undefined), 'null');
});
