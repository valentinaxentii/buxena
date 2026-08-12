/**
 * Which files the project-upload control accepts, and what it says when it
 * refuses one.
 *
 * Pulled out of the component so it can be tested without a browser. The DOM
 * wiring (drag events, the file picker) needs a real browser to verify; these
 * rules do not, and they are where the mistakes actually live — a MIME type
 * the OS did not set, a size limit off by a factor of 1024, a duplicate drop
 * silently doubling an attachment.
 *
 * Deliberately structural, not `File`-typed: the tests construct plain objects,
 * and a real File satisfies this shape.
 */

export interface UploadCandidate {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

/** Mirrors the input's `accept` attribute. Keep the two in step. */
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const ALLOWED_EXT = /\.(jpe?g|png|webp|pdf)$/i;
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 10;

/**
 * Type check by MIME where the OS provided one, by extension where it did not.
 *
 * Windows Explorer leaves `type` empty for some files depending on the
 * registry, and dropping a perfectly good PDF that the browser reports as ''
 * must not be refused — to the customer that reads as the feature being
 * broken, not as their file being wrong.
 */
export function isAllowedProjectFile(file: Pick<UploadCandidate, 'name' | 'type'>): boolean {
  if (file.type) return ALLOWED_MIME.includes(file.type);
  return ALLOWED_EXT.test(file.name);
}

export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

export function isSameFile(a: UploadCandidate, b: UploadCandidate): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

export interface MergeResult<T extends UploadCandidate> {
  /** The new attachment list. */
  files: T[];
  /** Human-readable reasons, one per refused file. */
  rejected: string[];
  /** How many were newly attached (duplicates count as neither). */
  added: number;
}

/**
 * Fold newly chosen or dropped files into the existing attachments.
 *
 * One function for both entry points on purpose: a file dropped and a file
 * picked must end up in exactly the same state, or the two paths drift and
 * only one of them gets fixed when something breaks.
 */
export function mergeProjectFiles<T extends UploadCandidate>(
  existing: T[],
  incoming: T[]
): MergeResult<T> {
  const files = [...existing];
  const rejected: string[] = [];
  let added = 0;

  for (const file of incoming) {
    if (files.length >= MAX_FILES) {
      rejected.push(`${file.name} (limit is ${MAX_FILES} files)`);
      continue;
    }
    if (!isAllowedProjectFile(file)) {
      rejected.push(`${file.name} (only JPG, PNG, WEBP or PDF)`);
      continue;
    }
    if (file.size === 0) {
      rejected.push(`${file.name} (file is empty)`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      rejected.push(`${file.name} (over ${MAX_BYTES / (1024 * 1024)} MB)`);
      continue;
    }
    // Dropping the same file twice is a slip, not an instruction.
    if (files.some((f) => isSameFile(f, file))) continue;

    files.push(file);
    added += 1;
  }

  return { files, rejected, added };
}

/**
 * The hidden field the enquiry carries. Files never leave the browser in this
 * MVP, so staff get an exact list to request by email reply — the wording says
 * so explicitly rather than implying an attachment is on its way.
 */
export function buildUploadMeta(files: UploadCandidate[]): string {
  if (files.length === 0) return '';
  const listed = files.map((f) => `${f.name} (${formatFileSize(f.size)})`).join(', ');
  return `Customer prepared ${files.length} file(s): ${listed} — PRIVATE project data, request by email reply; files were not transmitted.`;
}
