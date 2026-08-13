/**
 * Pull the structured answers back out of an enquiry's message.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every public form builds its `message` the same way: a block of the
 * customer's own prose, plus generated `Label: value` pairs joined either with
 * ' · ' or with newlines. The quote form's optional second step adds budget,
 * capacity, installation, foundation and electrical the same way, and since
 * 2026-08-13 that step merges into the first, so a fully-qualified lead can
 * arrive as one long paragraph of run-together label-value pairs.
 *
 * A salesperson opening that record had to read the whole blob to find the two
 * facts that decide the reply — where it is going and what they will spend.
 * This turns the blob back into fields so the answer is visible at a glance,
 * which is the difference between a first reply that quotes the right system
 * and one that asks questions the customer already answered.
 *
 * Pure and read-only: it re-presents what was captured and never changes,
 * infers or supplements it. The raw message stays on the page underneath —
 * this is a reading aid, not a replacement, and anything not recognised as a
 * field is preserved as prose rather than dropped.
 */

export interface EnquiryDetailField {
  label: string;
  value: string;
}

export interface ParsedEnquiryDetails {
  /** Recognised `Label: value` answers, in the order the customer gave them. */
  fields: EnquiryDetailField[];
  /** Everything else — the customer's own words, and the generated headers. */
  prose: string[];
}

/**
 * A label is short, starts with a letter, and holds no sentence punctuation.
 * Anything longer or messier is prose that happens to contain a colon (a
 * customer writing "Access: the gate is narrow, so..." still parses, which is
 * fine — that IS an answer worth surfacing).
 */
const LABEL = /^([A-Za-z][A-Za-z0-9 /&'()+-]{0,28}):\s*(.+)$/;

export function parseEnquiryDetails(message: string | null | undefined): ParsedEnquiryDetails {
  const fields: EnquiryDetailField[] = [];
  const prose: string[] = [];
  if (!message) return { fields, prose };

  for (const line of String(message).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ' · ' is the separator the forms use to pack several short answers onto
    // one line. Free text is never joined that way — it always gets its own
    // block — so splitting here cannot cut a sentence in half.
    for (const segment of trimmed.split(' · ')) {
      const piece = segment.trim();
      if (!piece) continue;

      const match = piece.match(LABEL);
      if (match) {
        fields.push({ label: match[1].trim(), value: match[2].trim() });
      } else if (fields.length && !prose.length) {
        // A fragment with no label of its own, directly after a field: almost
        // certainly a value that itself contained ' · '. Put it back rather
        // than losing half of what the customer wrote.
        fields[fields.length - 1].value += ` · ${piece}`;
      } else {
        prose.push(piece);
      }
    }
  }

  return { fields, prose };
}
