/**
 * Keeping the form's identity when the database will not store it.
 *
 * THE SITUATION
 * -------------
 * `enquiries.source` carries a CHECK constraint admitting five values. The
 * site sends twelve. Verified against the live database on 2026-08-13:
 * Website, Sauna Advisor and Quote Form insert; the other nine are rejected
 * outright, so a trade enquiry or a warranty claim reached the inbox but never
 * became a record anybody could work.
 *
 * supabase/migrations/2026-08-13-enquiry-source-constraint.sql fixes it
 * properly and only a founder can run it. Until then this keeps every form
 * producing a real, manageable CRM record instead of an email nobody can
 * assign, chase or report on.
 *
 * THE MECHANISM
 * -------------
 * On a rejected insert the API retries ONCE with an accepted source and writes
 * the true form name into the message as a `Form: …` line. Nothing is lost or
 * invented — the fact simply moves from a column the schema will not accept
 * into one it will. `effectiveSource()` reads it back, so the admin list, the
 * enquiry detail page and the suggested-reply template all keep showing and
 * behaving by the real form.
 *
 * WHEN THE MIGRATION IS APPLIED this becomes dead weight on the happy path:
 * the first insert succeeds, no `Form:` line is written, and effectiveSource()
 * just returns the column. It stays afterwards because it costs one string
 * comparison and it is the only thing standing between a schema surprise and
 * a silently unmanageable lead.
 */

/** Sources the un-migrated CHECK constraint accepts. Verified against prod. */
export const DB_SAFE_SOURCES = ['Website', 'Sauna Advisor', 'Contact Form', 'Quote Form', 'Other'];

/**
 * The fallback written to `source` when the real one is refused. 'Website' is
 * deliberate: it is true (the enquiry did come from the website) and it is the
 * column's own default, so nothing downstream meets a value it has not always
 * been able to receive.
 */
export const FALLBACK_SOURCE = 'Website';

const FORM_LINE = /^Form:[ \t]*(.+)$/m;

/**
 * Prepend the real form name to the message.
 *
 * First line, and labelled `Form:` so parseEnquiryDetails() lifts it into the
 * Project Answers grid like every other captured answer — a staff member sees
 * it without being told this mechanism exists.
 */
export function withFormLine(message: string | null, source: string | null): string {
  const form = (source ?? '').trim();
  if (!form) return message ?? '';
  return [`Form: ${form}`, message ?? ''].filter(Boolean).join('\n\n');
}

/**
 * The form this enquiry actually came from.
 *
 * Prefers the `Form:` line, because it is only ever written when the `source`
 * column could not hold the truth. Falls back to the column, which is correct
 * both for the three sources that always fitted and for every source once the
 * migration has run.
 */
export function effectiveSource(enquiry: {
  source?: string | null;
  message?: string | null;
} | null | undefined): string {
  const fromMessage = (enquiry?.message ?? '').match(FORM_LINE)?.[1]?.trim();
  if (fromMessage) return fromMessage;
  return (enquiry?.source ?? '').trim();
}

/** True when this Supabase error is the source CHECK constraint refusing the row. */
export function isSourceConstraintError(error: { message?: string } | null | undefined): boolean {
  const m = (error?.message ?? '').toLowerCase();
  return m.includes('enquiries_source_check') || (m.includes('check constraint') && m.includes('source'));
}
