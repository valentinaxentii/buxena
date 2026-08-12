/**
 * READ-ONLY check of the documents bucket and the signed-URL path.
 * Changes nothing: no uploads, no deletes, no bucket settings touched.
 *
 * Run it BEFORE flipping the bucket to private, to confirm signing works
 * against the real project, and AFTER, to confirm anonymous access is closed.
 *
 *   node scripts/verify-document-storage.mjs
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
    bad(`bucket "${BUCKET}" does not exist — run supabase/schema.sql`);
  } else if (bucket.public) {
    bad('bucket is PUBLIC — every stored file is readable by anyone with the URL');
    console.log('     Fix: run supabase/schema.sql (its insert…on conflict now sets public = false)');
  } else {
    ok('bucket is PRIVATE');
  }
}

console.log('\n■ Stored objects');
const { data: objects, error: listErr } = await supabase.storage
  .from(BUCKET)
  .list('', { limit: 100 });
if (listErr) {
  bad(`could not list objects: ${listErr.message}`);
} else if (!objects?.length) {
  ok('bucket is empty — nothing exposed either way (nothing to sign-test)');
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

console.log('\n' + '─'.repeat(60));
if (failures) {
  console.log(`${failures} problem(s) found. Nothing was changed by this script.`);
  process.exit(1);
}
console.log('All checks passed. Nothing was changed by this script.\n');
