/**
 * U.S. ZIP code validation — one definition, used by every form and by the
 * server.
 *
 * EXACTLY five digits. Leading zeroes are significant and must survive: 06410
 * is Cheshire, Connecticut — BUXENA's own state — and a field that drops the
 * leading zero turns it into 6410, which is not a ZIP code at all. That is why
 * every ZIP input is `type="text"` with `inputmode="numeric"` and never
 * `type="number"`: a number input strips leading zeroes, and its spinner and
 * scroll-to-change behaviour are wrong for an identifier that is not a
 * quantity.
 *
 * ZIP+4 (06410-1234) is deliberately NOT accepted. It was previously allowed
 * by the `\d{5}(-\d{4})?` pattern, but nothing downstream uses the +4 and the
 * requirement is a plain five digits, so the looser rule only widened what
 * could arrive.
 */

/** The one regex. Anchored, so it cannot match a longer string. */
export const ZIP_REGEX = /^\d{5}$/;

/**
 * For the HTML `pattern` attribute. Browsers anchor `pattern` implicitly, so
 * this is written without ^ and $ — including them is harmless but misleading
 * about how the attribute behaves.
 */
export const ZIP_INPUT_PATTERN = '\\d{5}';

/** Shown inline, in the browser's validation bubble, and by the server. */
export const ZIP_MESSAGE = 'Enter a valid 5-digit U.S. ZIP code.';

/**
 * Is this a valid U.S. ZIP code?
 *
 * Surrounding whitespace is tolerated because it is almost always a paste
 * artefact rather than something the customer typed on purpose. Whitespace or
 * punctuation INSIDE the value is not: "12 45" and "12-45" are rejected.
 */
export function isValidUsZip(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return ZIP_REGEX.test(value.trim());
}

/** Trimmed value for storage. Never alters the digits themselves. */
export function normalizeZip(value: string): string {
  return value.trim();
}

/**
 * Validate an optional ZIP field.
 *
 * Empty is allowed — most of these fields are optional, and "not answered" is
 * different from "answered wrongly". A value that is present but malformed is
 * always rejected.
 */
export function checkOptionalZip(value: unknown): { ok: true } | { ok: false; message: string } {
  if (value === undefined || value === null) return { ok: true };
  const raw = String(value).trim();
  if (raw === '') return { ok: true };
  return isValidUsZip(raw) ? { ok: true } : { ok: false, message: ZIP_MESSAGE };
}
