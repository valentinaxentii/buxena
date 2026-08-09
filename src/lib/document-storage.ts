import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Upload handling for the Documents page's Storage bucket (see schema.sql —
 * public bucket, random-UUID object paths, admin-only upload path).
 */

export const DOCUMENTS_BUCKET = 'documents';

// Netlify Functions cap a synchronous request body well under this — staying
// clear of that limit turns a mystifying 502 into a clear in-app message.
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Uploads to a random path so two files with the same name never collide. */
export async function uploadDocumentFile(
  supabase: SupabaseClient,
  file: File
): Promise<{ url: string } | { error: string }> {
  if (file.size === 0) return { error: 'The selected file is empty.' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `File is too large (max ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB).` };
  }

  const dot = file.name.lastIndexOf('.');
  const ext = dot > -1 ? file.name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  const path = `${randomUUID()}${ext}`;

  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) return { error: error.message };

  const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Best-effort cleanup — e.g. when a re-upload replaces a previous file. Never throws. */
export async function deleteDocumentFile(supabase: SupabaseClient, url: string): Promise<void> {
  const marker = `/object/public/${DOCUMENTS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return; // not a file stored in this bucket (an external link) — nothing to clean up
  const path = url.slice(idx + marker.length).split('?')[0];
  if (!path) return;
  try {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  } catch (err) {
    console.error('[document-storage] cleanup failed:', err);
  }
}
