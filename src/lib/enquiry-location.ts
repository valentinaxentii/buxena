/**
 * How a staff notification labels where an enquiry came from.
 *
 * WHY THIS EXISTS
 * ---------------
 * `enquiries.location` holds different things depending on which form sent it:
 * the quote, consultation, start-your-project and availability forms all put
 * the customer's ZIP there, while a trade enquiry puts a project location. Both
 * notifications printed it under one heading — "ZIP / Location" — so a
 * submission that carried a real ZIP of 06830 beside a placement answer of
 * "Outdoor" read as "ZIP / Location: Outdoor". The salesperson then had no ZIP
 * to check delivery against, and the placement was labelled as a postcode.
 *
 * So: a ZIP is shown as a ZIP, anything else is shown as a placement/location,
 * and a legacy submission that stored its ZIP in `location` still reads
 * correctly (it is recognised by shape, exactly as the admin page does).
 *
 * Pure, so both the email and the Telegram message can never disagree.
 */
import { ZIP_REGEX } from './zip.ts';

export interface ContactRow {
  label: string;
  value: string;
}

const ZIP_LABEL = 'ZIP / Postal Code';
const PLACEMENT_LABEL = 'Placement / Location';

export function contactLocationRows(zip?: string | null, location?: string | null): ContactRow[] {
  const z = (zip ?? '').trim();
  const l = (location ?? '').trim();

  if (z) {
    const rows: ContactRow[] = [{ label: ZIP_LABEL, value: z }];
    // Only when the two genuinely differ — the quote form sends the same ZIP in
    // both fields, and repeating it as a "placement" would be noise.
    if (l && l !== z) rows.push({ label: PLACEMENT_LABEL, value: l });
    return rows;
  }

  // Legacy: forms (and older submissions) put the ZIP in `location` itself.
  if (l && ZIP_REGEX.test(l)) return [{ label: ZIP_LABEL, value: l }];
  if (l) return [{ label: PLACEMENT_LABEL, value: l }];

  // An absent row reads as "the form is broken"; an em dash reads as "they did
  // not fill this in" — the distinction this file family already documents.
  return [{ label: ZIP_LABEL, value: '—' }];
}
