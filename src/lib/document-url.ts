/**
 * Document link handling for /admin/documents.
 *
 * The file_url column stores absolute external URLs (there is no storage
 * upload path and no relative-path usage in the Documents flow). Users may
 * type a bare domain; it is normalized ON SAVE. Existing rows saved without
 * a protocol are fixed at RENDER time only — never by a bulk migration.
 */

const DANGEROUS_SCHEME_MSG = (scheme: string) =>
  `Only http and https links can be saved — "${scheme}:" is not allowed.`;

/**
 * Normalize a user-entered URL before saving.
 * - trims whitespace
 * - keeps http:// / https:// exactly as typed (http is NOT upgraded)
 * - prepends https:// to bare domains ("buxena.com", "www.buxena.com/x.pdf")
 * - REJECTS any other scheme (javascript:, data:, file:, vbscript:, ftp:, …)
 *   — the value becomes an href, so an unconstrained scheme is an XSS vector.
 *
 * Note: "host:port/path" without a protocol technically parses as a scheme
 * too; a dot in the "scheme" marks it as a hostname, so "buxena.com:8080/x"
 * still normalizes instead of being rejected.
 */
export function normalizeDocumentUrl(raw: string): { url?: string; error?: string } {
  const v = (raw ?? '').trim();
  if (!v) return { error: 'File URL is required.' };
  const m = v.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (m) {
    const scheme = m[1].toLowerCase();
    if (scheme === 'http' || scheme === 'https') return { url: v };
    if (!scheme.includes('.')) return { error: DANGEROUS_SCHEME_MSG(scheme) };
    // scheme contains a dot -> it's really a hostname with a port
  }
  return { url: `https://${v}` };
}

/**
 * Defensive render-time href for stored values: old rows saved without a
 * protocol get https:// prepended so they don't resolve as relative links.
 * A stored dangerous scheme (shouldn't exist, but defensively) renders inert.
 */
export function resolveDocumentHref(stored: string | null | undefined): string {
  const v = (stored ?? '').trim();
  if (!v) return '#';
  const m = v.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (m) {
    const scheme = m[1].toLowerCase();
    if (scheme === 'http' || scheme === 'https') return v;
    if (!scheme.includes('.')) return '#';
  }
  return `https://${v}`;
}

const FILE_EXTENSIONS =
  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|zip|jpg|jpeg|png|webp|svg)$/i;

/**
 * "Open file" when the target is clearly a document/media file (by path
 * extension) or lives in this project's own Supabase storage; otherwise
 * "Open site". The category select was audited as a signal but describes the
 * BUSINESS type (Brochure, Invoice…), not file-vs-page — a Brochure can be
 * either — so the resolved URL is the honest source.
 */
export function documentLinkLabel(href: string, supabaseUrl?: string): 'Open file' | 'Open site' {
  if (supabaseUrl && href.startsWith(supabaseUrl.replace(/\/$/, ''))) return 'Open file';
  let path = href;
  try {
    path = new URL(href).pathname;
  } catch {
    /* keep raw string; extension test still works for most cases */
  }
  return FILE_EXTENSIONS.test(path) ? 'Open file' : 'Open site';
}
