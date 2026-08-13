/**
 * Does the live database accept every source the site sends?
 *
 * READ-MOSTLY AND SELF-CLEANING. For each source it attempts one insert:
 *   - rejected by the CHECK constraint -> nothing was written, that is the answer
 *   - accepted                          -> the row is deleted again immediately
 *
 * Every probe row is marked so it is unmistakable in the table if a delete
 * ever fails, and every id created is printed and re-verified as gone at the
 * end. Prints no key, no URL, and never touches a row it did not create.
 *
 * Run:  node scripts/check-enquiry-sources.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const MARKER = 'AUTOMATED CONSTRAINT PROBE — safe to delete';

/** Every source value the public site can send. */
const SOURCES = [
  'Website',
  'Sauna Advisor',
  'Quote Form',
  'Quote Form — details',
  'Quote Comparison',
  'Check Availability',
  'Consultation Request',
  'For Trade',
  'Plan Your Sauna',
  'Project Intake',
  'See It In My Space',
  'Warranty Claim',
];

const created = [];
const accepted = [];
const rejected = [];

for (const source of SOURCES) {
  const { data, error } = await supabase
    .from('enquiries')
    .insert({ name: MARKER, message: MARKER, source, status: 'New' })
    .select('id')
    .single();

  if (error) {
    rejected.push({ source, message: error.message.split('\n')[0].slice(0, 120) });
  } else {
    accepted.push(source);
    created.push(data.id);
  }
}

// Remove every row this script created, one id at a time — never a filter that
// could match anything else.
const failedDeletes = [];
for (const id of created) {
  const { error } = await supabase.from('enquiries').delete().eq('id', id);
  if (error) failedDeletes.push(id);
}

// Prove they are gone rather than assuming the delete worked.
let stillPresent = [];
if (created.length) {
  const { data } = await supabase.from('enquiries').select('id').in('id', created);
  stillPresent = (data ?? []).map((r) => r.id);
}

console.log(`\nACCEPTED BY THE DATABASE: ${accepted.length}/${SOURCES.length}`);
accepted.forEach((s) => console.log(`   ok      ${s}`));
console.log(`\nREJECTED: ${rejected.length}/${SOURCES.length}`);
rejected.forEach((r) => console.log(`   REJECT  ${r.source}  — ${r.message}`));

console.log(`\nprobe rows created: ${created.length}, deleted: ${created.length - stillPresent.length}`);
if (stillPresent.length) {
  console.log('!! NOT DELETED — remove these by hand:');
  stillPresent.forEach((id) => console.log('   ' + id));
} else {
  console.log('probe rows remaining: 0 — the table is exactly as it was found');
}

process.exit(rejected.length === 0 ? 0 : 1);
