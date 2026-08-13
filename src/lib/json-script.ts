/**
 * Serialize a value for embedding inside a <script> element.
 *
 * THE BUG THIS EXISTS TO PREVENT
 * ------------------------------
 * `set:html={JSON.stringify(rows)}` writes the result into the document
 * verbatim, and `JSON.stringify` does not escape `<` or `/`. So a value
 * containing the characters `</script` closes the tag early and everything
 * after it is parsed as markup:
 *
 *     JSON.stringify([{ name: '</script><script>alert(1)</script>' }])
 *     -> [{"name":"</script><script>alert(1)</script>"}]
 *
 * That was reachable from the public site. A visitor's enquiry name is copied
 * to `leads.name` and then to `customers.name` by convertEnquiryToLead /
 * createQuoteFromEnquiry, and Admin -> Invoices -> New embeds the customer
 * list this way. So a name typed into a public form could run script in the
 * admin panel, in the admin's own session, the moment a staff member opened
 * that page — full CRM read/write, with no credential ever stolen.
 *
 * THE FIX
 * -------
 * Escape the three characters that can start markup, plus the two Unicode line
 * terminators that are legal in JSON but illegal in a JavaScript string
 * literal. The output is still valid JSON and `JSON.parse` returns exactly the
 * same value — `<` inside a JSON string IS `<`.
 *
 * Replacing across the whole serialized text is safe: outside of string
 * literals, JSON contains only `{}[]",:`, digits and whitespace, so these five
 * characters can only ever occur inside a string.
 *
 * USE THIS FOR EVERY <script> PAYLOAD — `application/json` and
 * `application/ld+json` alike — not just the ones whose data looks
 * attacker-controlled today. The rule is worth having precisely because the
 * next person cannot be expected to re-derive which fields are reachable.
 */

// Built from char codes, never typed literally: U+2028 and U+2029 are
// invisible and several editors and transports silently rewrite them to a
// plain space. A space in this table would escape every space in every
// payload, so the one character that must not be guessed is computed.
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

/**
 * `<` becomes the six characters backslash-u-0-0-3-c. Derived from the
 * character own code point rather than written out, for the same reason as
 * above: a hand-typed escape table is one silent transcription slip away from
 * replacing a character with itself, which reads as working and protects
 * nothing.
 */
const BACKSLASH = String.fromCharCode(92);
const escapeChar = (c: string) =>
  BACKSLASH + 'u' + c.charCodeAt(0).toString(16).padStart(4, '0');

const UNSAFE = new RegExp('[<>&' + LINE_SEP + PARA_SEP + ']', 'g');

export function jsonForScript(value: unknown): string {
  return JSON.stringify(value ?? null).replace(UNSAFE, escapeChar);
}
