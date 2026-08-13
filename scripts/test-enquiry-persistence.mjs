/**
 * End-to-end proof that every public form becomes a manageable CRM record.
 *
 * Exercises the REAL insert path against the REAL database, once per source,
 * including the source-constraint fallback in lib/enquiry-source.ts — so it
 * passes both before and after the 2026-08-13 migration is applied.
 *
 * SELF-CLEANING. Every row it creates is marked, tracked by id, deleted at the
 * end, and then re-queried to prove it is gone. It never touches a row it did
 * not create, and it prints the before/after counts of every table it could
 * possibly affect so "existing data preserved" is evidence, not a claim.
 *
 * Run:  node scripts/test-enquiry-persistence.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { effectiveSource, isSourceConstraintError, withFormLine, FALLBACK_SOURCE } from '../src/lib/enquiry-source.ts';
import { parseEnquiryDetails } from '../src/lib/enquiry-details.ts';
import { buildEnquiryReply } from '../src/lib/enquiry-reply-templates.ts';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const MARKER = 'AUTOMATED PERSISTENCE TEST — safe to delete';
const TABLES = ['enquiries', 'leads', 'customers', 'quotes', 'activities', 'documents'];

const countAll = async () => {
  const out = {};
  for (const t of TABLES) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    out[t] = count ?? 0;
  }
  return out;
};

/** One representative submission per form, with the context that form captures. */
const CASES = [
  { source: 'Quote Form', model: 'BUH-UKU 230', message: 'Pricing request\n\nZIP: 02138 · Placement: Outdoor · Timeline: 1–3 months' },
  { source: 'Quote Form — details', model: 'BUH-UKU 230', message: 'People: 3–4\nBudget: $10,000 – $20,000\nFoundation: Need guidance' },
  { source: 'Quote Comparison', model: 'BUH-ELLA H2', message: 'Pricing request (has another quote to compare)\n\nZIP: 94110' },
  { source: 'Check Availability', model: 'BUH-UKU 160', message: 'Availability request for BUH-UKU 160 — ZIP 02138' },
  { source: 'Consultation Request', model: 'BUH-ELLA H2', message: 'CONSULTATION REQUEST — Video call\nZIP: 94110\nPreferred time: Weekday mornings' },
  { source: 'For Trade', model: 'BUH-UKU 230', message: 'Boutique hotel project.\n\nTRADE LEAD · Company: Northwood · Role: Architect · Project location: Aspen, CO' },
  { source: 'Plan Your Sauna', model: 'BUH-ILLI H2', message: 'Advisor shortlist review request\n\nZIP: 33139' },
  { source: 'Project Intake', model: 'BUH-ILLI H2', message: 'Backyard by the pool.\n\nProject type: residential · ZIP: 33139 · Timeline: As soon as possible' },
  { source: 'See It In My Space', model: 'BUH-ELLA H1', message: 'Space visualization request\n\nZIP: 10001' },
  { source: 'Warranty Claim', model: 'BUH-ALLA H1', message: 'WARRANTY CLAIM\nNoticed a crack in a bench slat.' },
  { source: 'Sauna Advisor', model: '', message: 'Chat: what heater do I need?' },
  { source: 'Website', model: '', message: 'General enquiry from the website.' },
];

const before = await countAll();
console.log('BEFORE:', TABLES.map((t) => `${t}=${before[t]}`).join('  '));

const createdIds = [];
const results = [];

for (const [i, c] of CASES.entries()) {
  const row = {
    name: `${MARKER} ${i + 1}`,
    email: `persistence-test-${i + 1}@buxena-test.invalid`,
    phone: '555-0100',
    location: '02138',
    message: c.message,
    sauna_interest: c.model || null,
    source: c.source,
    status: 'New',
  };

  let { data, error } = await supabase.from('enquiries').insert(row).select('id').single();
  let usedFallback = false;

  if (error && isSourceConstraintError(error)) {
    usedFallback = true;
    ({ data, error } = await supabase
      .from('enquiries')
      .insert({ ...row, source: FALLBACK_SOURCE, message: withFormLine(row.message, row.source) })
      .select('id')
      .single());
  }

  if (error || !data) {
    results.push({ source: c.source, ok: false, detail: error?.message?.slice(0, 90) ?? 'no row' });
    continue;
  }
  createdIds.push(data.id);

  // Read it back exactly as the admin would.
  const { data: stored } = await supabase
    .from('enquiries')
    .select('id, name, email, phone, location, message, sauna_interest, source, status, created_at')
    .eq('id', data.id)
    .single();

  const shownSource = effectiveSource(stored);
  const details = parseEnquiryDetails(stored.message);
  const reply = buildEnquiryReply({
    name: stored.name,
    phone: stored.phone,
    location: stored.location,
    saunaInterest: stored.sauna_interest,
    source: shownSource,
  });

  results.push({
    source: c.source,
    ok:
      shownSource === c.source &&
      stored.status === 'New' &&
      stored.email === row.email &&
      stored.phone === row.phone &&
      (c.model ? stored.sauna_interest === c.model : true),
    fallback: usedFallback,
    shownSource,
    model: stored.sauna_interest ?? '—',
    fields: details.fields.length,
    template: reply.templateName,
  });
}

console.log('\nPER FORM — stored, read back, and rendered as the admin would see it\n');
console.log(
  '  ' +
    'FORM'.padEnd(23) +
    'REC '.padEnd(5) +
    'SHOWN AS'.padEnd(23) +
    'MODEL'.padEnd(15) +
    'ANS'.padEnd(5) +
    'REPLY TEMPLATE'
);
for (const r of results) {
  console.log(
    '  ' +
      r.source.padEnd(23) +
      (r.ok ? ' ok ' : 'FAIL').padEnd(5) +
      String(r.shownSource ?? r.detail ?? '').padEnd(23) +
      String(r.model ?? '').padEnd(15) +
      String(r.fields ?? '').padEnd(5) +
      String(r.template ?? '')
  );
}

const passed = results.filter((r) => r.ok).length;
const viaFallback = results.filter((r) => r.fallback).length;
console.log(`\nmanageable records created: ${passed}/${CASES.length}   (via constraint fallback: ${viaFallback})`);

// ---- clean up, then prove it ------------------------------------------------
for (const id of createdIds) await supabase.from('enquiries').delete().eq('id', id);
const { data: leftover } = createdIds.length
  ? await supabase.from('enquiries').select('id').in('id', createdIds)
  : { data: [] };

const after = await countAll();
console.log('\nAFTER: ', TABLES.map((t) => `${t}=${after[t]}`).join('  '));

const drift = TABLES.filter((t) => before[t] !== after[t]);
console.log('test rows left behind: ' + (leftover ?? []).length);
console.log(
  drift.length
    ? '!! ROW COUNT DRIFT in: ' + drift.map((t) => `${t} ${before[t]}->${after[t]}`).join(', ')
    : 'existing data preserved: every table back to its original count'
);

process.exit(passed === CASES.length && !drift.length && !(leftover ?? []).length ? 0 : 1);
