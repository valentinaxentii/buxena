import type { SupabaseClient } from '@supabase/supabase-js';
// Explicit .ts extension: this module is imported by tests that run under bare
// `node --test`, which resolves extensionless specifiers only for .js. Vite and
// astro check both accept the extension, so it costs nothing.
import { DOCUMENTS_BUCKET } from './document-storage.ts';

/**
 * Read access to documents held in Supabase Storage.
 *
 * WHY THIS EXISTS
 * The `documents` bucket used to be public: every uploaded file was readable
 * by anyone who had the URL, with an unguessable path as the only protection.
 * That is adequate for an installation manual and completely inadequate for
 * the things the upload form actually offers to store — Supplier Price List,
 * Invoice, Customer Quote, Purchase Order. Dealer cost is the core commercial
 * secret of this business, and a forwarded link was enough to hand it over.
 *
 * The bucket is now PRIVATE. Nothing in it is reachable without a signature.
 * Every read goes through this module, which mints a short-lived signed URL
 * server-side at render time.
 *
 * WHAT IS AND IS NOT PROTECTED
 * The signature is minted only after the page has established who is asking:
 * an admin page behind the auth middleware, or the unit passport page, where
 * the unguessable public_token is itself the capability. A signed URL still
 * works for whoever holds it until it expires — that is the point of a link
 * a customer can open — so expiry is deliberately short.
 *
 * The service-role key never leaves the server. It is used here to mint the
 * signature; the browser only ever receives the resulting time-limited URL.
 */

/**
 * How long a minted link stays valid. Long enough to open the file, and to
 * still work if someone opens the page, gets distracted, and comes back;
 * short enough that a link pasted into a group chat is dead well before it
 * spreads. Applies to both staff and customer links.
 */
export const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * The object path inside the documents bucket, or null when this value is not
 * one of our stored files (an external link typed into the form).
 *
 * Accepts both URL shapes so no data migration is needed:
 *   - `…/storage/v1/object/public/documents/<path>`  — every row written while
 *     the bucket was public, and what uploads still record today. With a
 *     private bucket that URL no longer resolves on its own; it is kept as a
 *     stable identifier that carries the path, and is signed on every read.
 *   - `…/storage/v1/object/sign/documents/<path>`    — a previously signed URL
 *     that found its way into the column.
 */
export function documentStoragePath(url: string | null | undefined): string | null {
  const v = (url ?? '').trim();
  if (!v) return null;
  for (const marker of [
    `/object/public/${DOCUMENTS_BUCKET}/`,
    `/object/sign/${DOCUMENTS_BUCKET}/`,
  ]) {
    const idx = v.indexOf(marker);
    if (idx === -1) continue;
    const path = v.slice(idx + marker.length).split('?')[0];
    if (path) return decodeURIComponent(path);
  }
  return null;
}

/** True when this value points at a file we hold, rather than an external site. */
export function isStoredDocument(url: string | null | undefined): boolean {
  return documentStoragePath(url) !== null;
}

/**
 * A URL the browser can actually open.
 *
 * Our own objects come back as a signed, expiring link. External links are
 * returned unchanged — they were never ours to protect. A file that has gone
 * missing from storage returns null rather than a broken link, so callers can
 * say so instead of rendering an href that 400s.
 */
export async function signDocumentUrl(
  supabase: SupabaseClient,
  url: string | null | undefined,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const path = documentStoragePath(url);
  if (!path) return (url ?? '').trim() || null;

  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) {
      console.error('[document-access] could not sign', path, error?.message ?? 'no url returned');
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.error('[document-access] signing threw:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Batch form of signDocumentUrl, for pages that render a list.
 *
 * Returns a Map keyed by the ORIGINAL stored value, so a caller can look up
 * each row it already has without tracking array positions. One round trip for
 * all stored files instead of one per row; external links never leave here.
 */
export async function signDocumentUrls(
  supabase: SupabaseClient,
  urls: (string | null | undefined)[],
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();

  // Deduplicate: the same document can appear more than once on a page.
  const pathByUrl = new Map<string, string>();
  for (const url of urls) {
    const key = (url ?? '').trim();
    if (!key || out.has(key) || pathByUrl.has(key)) continue;
    const path = documentStoragePath(key);
    if (path) pathByUrl.set(key, path);
    else out.set(key, key); // external link — passes through untouched
  }

  if (pathByUrl.size === 0) return out;

  const paths = [...new Set(pathByUrl.values())];
  const signedByPath = new Map<string, string | null>();
  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrls(paths, expiresIn);
    if (error) {
      console.error('[document-access] batch signing failed:', error.message);
    } else {
      for (const entry of data ?? []) {
        // `path` comes back on each entry; a per-file error leaves signedUrl null.
        if (entry.path) signedByPath.set(entry.path, entry.signedUrl ?? null);
      }
    }
  } catch (e) {
    console.error('[document-access] batch signing threw:', e instanceof Error ? e.message : e);
  }

  for (const [url, path] of pathByUrl) {
    out.set(url, signedByPath.get(path) ?? null);
  }
  return out;
}
