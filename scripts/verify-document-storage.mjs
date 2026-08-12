/**
 * Checks the documents bucket and the signed-URL path.
 *
 *   node scripts/verify-document-storage.mjs           read-only
 *   node scripts/verify-document-storage.mjs --probe   proves it, see below
 *
 * The default run changes nothing. `--probe` uploads one tiny throwaway file
 * and deletes it again, which is the only way to prove an unsigned URL is
 * actually refused when the bucket is empty.
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env. Neither is
 * printed, and no signed URL is written to disk — one is fetched to prove it
 * resolves, then discarded.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const BUCKET = 'documents';
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.log(`  ✗ ${m}`); failures++; };

console.log('\n■ Bucket visibility');
const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
if (bucketErr) {
  bad(`could not list buckets: ${bucketErr.message}`);
} else {
  const bucket = buckets.find((b) => b.id === BUCKET);
  if (!bucket) {
    bad(`bucket "${BUCKET}" does not exist — run supabase/migrations/2026-08-12-archive-and-private-documents.sql`);
  } else if (bucket.public) {
    bad('bucket is PUBLIC — every stored file is readable by anyone with the URL');
    console.log('     Fix: run supabase/migrations/2026-08-12-archive-and-private-documents.sql');
  } else {
    ok('bucket is PRIVATE');
  }
}

/**
 * The decisive test — "an unsigned URL is refused" — needs an object to aim
 * at, and immediately after the migration the bucket is empty. `--probe`
 * uploads a tiny throwaway file, runs the real round-trip against it, and
 * deletes it again. It is the only way to PROVE the bucket is closed rather
 * than infer it from a flag.
 *
 * Opt-in because it writes: the default run stays strictly read-only.
 */
const PROBE = process.argv.includes('--probe');

console.log('\n■ Stored objects');
const { data: objects, error: listErr } = await supabase.storage
  .from(BUCKET)
  .list('', { limit: 100 });

let probePath = null;
if (!listErr && !objects?.length && PROBE) {
  probePath = `_verify-probe-${Date.now()}.txt`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(probePath, new Blob(['buxena storage verification probe']), {
      contentType: 'text/plain',
      upsert: true,
    });
  if (upErr) {
    bad(`probe upload failed: ${upErr.message}`);
    probePath = null;
  } else {
    ok(`probe object uploaded (${probePath}) — removed at the end of this run`);
    objects.push({ name: probePath, id: 'probe' });
  }
}

if (listErr) {
  bad(`could not list objects: ${listErr.message}`);
} else if (!objects?.length) {
  ok('bucket is empty — nothing exposed either way');
  console.log('     Re-run with --probe to PROVE the unsigned URL is refused:');
  console.log('       node scripts/verify-document-storage.mjs --probe');
} else {
  ok(`${objects.length} object(s) stored`);

  const sample = objects.find((o) => o.id) ?? objects[0];
  console.log(`\n■ Signed URL (sample: ${sample.name})`);
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(sample.name, 60);
  if (signErr || !signed?.signedUrl) {
    bad(`could not sign: ${signErr?.message ?? 'no URL returned'}`);
  } else {
    ok('signed URL minted');
    const signedRes = await fetch(signed.signedUrl, { method: 'HEAD' });
    if (signedRes.ok) ok(`signed URL resolves (HTTP ${signedRes.status})`);
    else bad(`signed URL did NOT resolve (HTTP ${signedRes.status})`);

    // The real question: is the unsigned path still open to the world?
    const publicUrl = `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(sample.name)}`;
    const publicRes = await fetch(publicUrl, { method: 'HEAD' });
    console.log('\n■ Anonymous access (the thing being closed)');
    if (publicRes.ok) {
      bad(`UNSIGNED URL STILL WORKS (HTTP ${publicRes.status}) — the bucket is still public`);
    } else {
      ok(`unsigned URL refused (HTTP ${publicRes.status}) — anonymous access is closed`);
    }
  }
}

// Always clean up the probe, including when a check above failed — a
// verification script must not leave litter in the bucket it just inspected.
if (probePath) {
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([probePath]);
  console.log(
    rmErr
      ? `\n  ! probe object ${probePath} could NOT be removed: ${rmErr.message} — delete it by hand`
      : `\n  ✓ probe object removed (${probePath})`
  );
  if (rmErr) failures++;
}

console.log('\n' + '─'.repeat(60));
if (failures) {
  console.log(`${failures} problem(s) found.`);
  process.exit(1);
}
console.log(
  probePath
    ? 'All checks passed. The bucket is closed to unsigned access.\n'
    : 'All checks passed. Nothing was changed by this script.\n'
);
