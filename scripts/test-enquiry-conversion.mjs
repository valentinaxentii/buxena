/**
 * Enquiry -> Lead -> Quote, against the real database.
 *
 * Proves the parts a salesperson depends on and that a unit test cannot reach:
 * that a fallback-recorded enquiry still converts to a lead carrying the TRUE
 * form name, that converting twice cannot produce a second lead or quote, and
 * that a malformed id is refused rather than half-applied.
 *
 * SELF-CLEANING, and careful about it: every id created is tracked and removed
 * in dependency order, pre-existing rows are counted before and after, and
 * nothing is ever deleted by a filter that could match a record it did not
 * create.
 *
 * Run:  node scripts/test-enquiry-conversion.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { convertEnquiryToLead, createQuoteFromEnquiry } from '../src/lib/enquiry-conversion.ts';
import { withFormLine, FALLBACK_SOURCE } from '../src/lib/enquiry-source.ts';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const MARKER = 'AUTOMATED CONVERSION TEST — safe to delete';
const TABLES = ['enquiries', 'leads', 'customers', 'quotes', 'activities'];
const countAll = async () => {
  const o = {};
  for (const t of TABLES) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    o[t] = count ?? 0;
  }
  return o;
};

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

const before = await countAll();
console.log('BEFORE:', TABLES.map((t) => `${t}=${before[t]}`).join('  '));
console.log('');

const created = { enquiries: [], leads: [], quotes: [], customers: [] };

// A trade enquiry recorded the way the un-migrated database forces: fallback
// source, true form in the message.
const { data: enq } = await supabase
  .from('enquiries')
  .insert({
    name: MARKER,
    email: 'conversion-test@buxena-test.invalid',
    phone: '555-0142',
    location: '02138',
    sauna_interest: 'BUH-UKU 230',
    message: withFormLine('Boutique hotel project. TRADE LEAD · Company: Northwood', 'For Trade'),
    source: FALLBACK_SOURCE,
    status: 'New',
  })
  .select('id')
  .single();
created.enquiries.push(enq.id);

// --- convert ----------------------------------------------------------------
const r1 = await convertEnquiryToLead(supabase, enq.id, null);
check('enquiry converts to a lead', r1.ok === true, r1.ok ? '' : String(r1.reason));
if (r1.ok) created.leads.push(r1.leadId);

const { data: lead } = await supabase.from('leads').select('*').eq('id', r1.leadId).single();
check('lead carries the TRUE form, not the stored fallback', lead?.source === 'For Trade', `source=${lead?.source}`);
check('lead carries the customer contact', lead?.email === 'conversion-test@buxena-test.invalid' && lead?.phone === '555-0142');
check('lead carries the product context', Boolean(lead?.notes?.includes('Northwood')), 'notes preserved');

// --- duplicate guard --------------------------------------------------------
const r2 = await convertEnquiryToLead(supabase, enq.id, null);
check('converting twice is refused', r2.ok === false && r2.reason === 'ALREADY_CONVERTED', String(r2.reason));
const { count: leadCount } = await supabase
  .from('leads')
  .select('*', { count: 'exact', head: true })
  .eq('email', 'conversion-test@buxena-test.invalid');
check('no duplicate lead was created', leadCount === 1, `${leadCount} lead(s)`);

// --- quote ------------------------------------------------------------------
const q1 = await createQuoteFromEnquiry(supabase, enq.id, null);
check('enquiry creates a quote', q1.ok === true, q1.ok ? '' : String(q1.reason));
if (q1.ok) created.quotes.push(q1.quoteId);
const { data: quoteRow } = q1.ok
  ? await supabase.from('quotes').select('id, customer_id, lead_id').eq('id', q1.quoteId).single()
  : { data: null };
if (quoteRow?.customer_id) {
  const { data: cust } = await supabase.from('customers').select('id, lead_source, email').eq('id', quoteRow.customer_id).single();
  // Only clean up a customer this run created.
  if (cust?.email === 'conversion-test@buxena-test.invalid') created.customers.push(cust.id);
  check('customer carries the TRUE form', cust?.lead_source === 'For Trade', `lead_source=${cust?.lead_source}`);
}
check('quote is linked to the lead', quoteRow?.lead_id === r1.leadId);

const q2 = await createQuoteFromEnquiry(supabase, enq.id, null);
check('creating a second quote is refused', q2.ok === false && q2.reason === 'ALREADY_CONVERTED', String(q2.reason));

// --- malformed ids ----------------------------------------------------------
for (const bad of ['not-a-uuid', '00000000-0000-0000-0000-000000000000', "'; drop table enquiries;--"]) {
  const r = await convertEnquiryToLead(supabase, bad, null).catch((e) => ({ ok: false, reason: 'threw: ' + e.message.slice(0, 40) }));
  check(`malformed id refused: ${bad.slice(0, 24)}`, r.ok === false, String(r.reason).slice(0, 60));
}

// --- clean up, child rows first --------------------------------------------
for (const id of created.quotes) await supabase.from('quotes').delete().eq('id', id);
for (const id of created.enquiries) await supabase.from('activities').delete().eq('entity_type', 'enquiry').eq('entity_id', id);
for (const id of created.enquiries) await supabase.from('enquiries').delete().eq('id', id);
for (const id of created.leads) await supabase.from('leads').delete().eq('id', id);
for (const id of created.customers) await supabase.from('customers').delete().eq('id', id);

const after = await countAll();
console.log('');
console.log('AFTER: ', TABLES.map((t) => `${t}=${after[t]}`).join('  '));
const drift = TABLES.filter((t) => before[t] !== after[t]);
console.log(
  drift.length
    ? '!! ROW COUNT DRIFT: ' + drift.map((t) => `${t} ${before[t]}->${after[t]}`).join(', ')
    : 'existing data preserved: every table back to its original count'
);

const failed = checks.filter((c) => !c.pass).length;
console.log(`\nconversion checks: ${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 && !drift.length ? 0 : 1);
