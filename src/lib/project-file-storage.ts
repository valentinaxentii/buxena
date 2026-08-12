import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DOCUMENTS_BUCKET } from './document-storage.ts';

/**
 * Storage for customer-supplied project files (backyard photos, plans).
 *
 * Same private bucket as staff documents, under its own prefix. One bucket
 * means one privacy setting to get right and one place signed URLs are minted;
 * a second bucket would be a second thing to remember to lock down.
 */

/** Everything a customer uploads lives under here. */
export const PROJECT_FILE_PREFIX = 'project-files';

/**
 * The stored object name is a random UUID — never the customer's filename.
 *
 * A customer filename is untrusted input: it can contain path separators,
 * unicode direction marks, or the name of somebody's home. Storing it as the
 * object key would put all of that into a URL. The real name is kept in
 * `documents.file_name`, where staff can read it and it can never affect a
 * path.
 *
 * The extension is preserved, stripped to a conservative character set, so
 * a browser still opens the file as the right type.
 */
export function projectFileObjectPath(originalName: string): string {
  const dot = originalName.lastIndexOf('.');
  const ext = dot > -1 ? originalName.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  // Cap the extension so a pathological name cannot produce an absurd key.
  const safeExt = ext.length <= 10 ? ext : '';
  return `${PROJECT_FILE_PREFIX}/${randomUUID()}${safeExt}`;
}

export async function uploadProjectFile(
  supabase: SupabaseClient,
  file: File
): Promise<{ url: string; path: string } | { error: string }> {
  const path = projectFileObjectPath(file.name);

  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    // Never overwrite. A UUID collision is vanishingly unlikely, but `upsert:
    // true` would turn one into silent data loss of a customer's file.
    upsert: false,
  });
  if (error) return { error: error.message };

  // getPublicUrl on a PRIVATE bucket does not grant access — the URL it builds
  // is refused. It is used here only because it is the same identifier format
  // every other document row already stores, and lib/document-access.ts knows
  // how to turn it back into an object path to sign. Nothing renders it raw.
  const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
