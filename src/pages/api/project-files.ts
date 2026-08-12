import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import { checkRateLimit } from '../../lib/rate-limit';
import { PROJECT_FILE_PREFIX, uploadProjectFile } from '../../lib/project-file-storage';
import { isAllowedProjectFile, MAX_BYTES, MAX_FILES } from '../../lib/project-upload-files';

export const prerender = false;

/**
 * Receives the photos and plans a customer attached to an enquiry.
 *
 * ORDERING — the lead is never at risk. The browser submits the enquiry FIRST
 * through /api/enquiries and only calls this endpoint once it has an enquiry
 * id. So:
 *   - enquiry fails  → nothing is uploaded, no orphaned objects
 *   - upload fails   → the lead is already captured, staff still get it, and
 *                      the enquiry note says which files to ask for
 * Files are the enhancement; the lead is the thing that must not be lost.
 *
 * PRIVACY — objects go to the private `documents` bucket under a
 * `project-files/` prefix with random names. Nothing here ever returns a
 * public URL: staff read them through short-lived signed URLs minted
 * server-side behind admin auth (lib/document-access.ts).
 */

const GENERIC_ERROR = "We couldn't attach your files. Your enquiry was still received.";

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Uploads are far more expensive than a form post, so this is tighter than
  // the enquiry limit. A real customer sends one batch.
  const { allowed } = checkRateLimit(`project-files:${clientAddress}`, 6, 10 * 60_000);
  if (!allowed) {
    return json({ ok: false, error: 'Too many uploads. Please try again shortly.' }, 429);
  }

  // Local dev never touches production storage — same contract as the
  // enquiries endpoint, so the whole form is testable with no .env at all.
  const devTestMode = import.meta.env.DEV && process.env.ENQUIRIES_DEV_LIVE !== 'true';

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: GENERIC_ERROR }, 400);
  }

  const enquiryId = String(form.get('enquiryId') ?? '').trim();
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

  // A file with no enquiry to belong to is exactly the orphan this endpoint
  // exists to prevent.
  if (!enquiryId) return json({ ok: false, error: GENERIC_ERROR }, 400);
  if (files.length === 0) return json({ ok: true, uploaded: 0 }, 200);
  if (files.length > MAX_FILES) {
    return json({ ok: false, error: `Please attach at most ${MAX_FILES} files.` }, 400);
  }

  // Re-validate everything the browser checked. The browser can be bypassed.
  for (const file of files) {
    if (!isAllowedProjectFile({ name: file.name, type: file.type })) {
      return json({ ok: false, error: 'Only JPG, PNG, WEBP or PDF files can be attached.' }, 400);
    }
    if (file.size > MAX_BYTES) {
      return json(
        { ok: false, error: `Each file must be under ${MAX_BYTES / (1024 * 1024)} MB.` },
        400
      );
    }
  }

  if (devTestMode) {
    console.log(
      `[project-files][dev] would upload ${files.length} file(s) for enquiry ${enquiryId}:`,
      files.map((f) => `${f.name} (${f.size} bytes)`).join(', ')
    );
    return json({ ok: true, uploaded: files.length, devMode: true }, 200);
  }

  try {
    const supabase = createSupabaseAdminClient();

    // The enquiry must exist. Without this check the endpoint would accept any
    // uuid and let a stranger deposit files against someone else's enquiry —
    // or against a random id, filling private storage with unreachable
    // objects.
    const { data: enquiry, error: lookupError } = await supabase
      .from('enquiries')
      .select('id')
      .eq('id', enquiryId)
      .maybeSingle();
    if (lookupError || !enquiry) {
      console.error('[project-files] unknown enquiry:', enquiryId, lookupError?.message ?? '');
      return json({ ok: false, error: GENERIC_ERROR }, 400);
    }

    let uploaded = 0;
    for (const file of files) {
      const result = await uploadProjectFile(supabase, file);
      if ('error' in result) {
        console.error('[project-files] upload failed:', result.error);
        continue;
      }

      const { error: insertError } = await supabase.from('documents').insert({
        category: 'Customer Project File',
        file_url: result.url,
        file_name: file.name,
        enquiry_id: enquiryId,
        notes: 'Uploaded by the customer with their enquiry.',
      });

      if (insertError) {
        // The object landed but the row did not, so nothing points at it.
        // Remove it rather than leave a private file nobody can find or
        // delete — an orphan in a private bucket is invisible, not harmless.
        console.error('[project-files] row insert failed, removing object:', insertError.message);
        await supabase.storage.from('documents').remove([result.path]).catch(() => {});
        continue;
      }
      uploaded += 1;
    }

    if (uploaded === 0) return json({ ok: false, error: GENERIC_ERROR }, 500);
    return json({ ok: true, uploaded }, 200);
  } catch (e) {
    console.error('[project-files] failed:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: GENERIC_ERROR }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export { PROJECT_FILE_PREFIX };
