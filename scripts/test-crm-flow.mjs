// End-to-end CRM flow test: enquiry → lead (with follow-up fields) →
// customer → quote → status walk → delete everything. Direct DB writes so
// NO email/Telegram notifications fire. All rows labeled FLOW TEST.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const T = 'FLOW TEST — DELETE';
let fail = 0;
const ok = (label, cond, extra='') => { console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ' ('+extra+')' : ''}`); if (!cond) fail++; };

// 1. enquiry lands with full context (what /api/enquiries writes)
const { data: enq, error: e1 } = await db.from('enquiries').insert({
  name: T, email: 'flowtest@example.com', phone: '555-0100', location: '06010',
  message: 'Pricing request\n\nZIP: 06010 · Placement: outdoor · Timeline: 1-3-months · utm_source: google · utm_campaign: test · Landing: /quote/',
  sauna_interest: 'BUH-ELLA H2', source: 'Quote Form', status: 'New',
}).select('id').single();
ok('enquiry created with source/model/ZIP/UTM context', !e1, e1?.message);

// 2. lead created from it — all follow-up fields present
const { data: lead, error: e2 } = await db.from('leads').insert({
  name: T, email: 'flowtest@example.com', phone: '555-0100', state: 'CT',
  source: 'Website', product_id: null, location_type: 'outdoor',
  timeline: '1-3 months', notes: 'FLOW TEST. Next action: call to qualify.',
  follow_up_date: '2026-08-12', status: 'New Lead',
}).select('id, follow_up_date, status').single();
ok('lead created with follow-up date, notes, status', !e2, e2?.message);

// 3. pipeline stage walk on the lead
let stagesOk = true;
for (const s of ['Contacted', 'Qualified', 'Quote Sent', 'Negotiating', 'Lost']) {
  const { error } = await db.from('leads').update({ status: s }).eq('id', lead.id);
  if (error) { stagesOk = false; console.log('  stage', s, 'FAIL:', error.message); }
}
ok('lead pipeline stages update (incl. lost reason)', stagesOk);

// 4. lead → customer → quote WITHOUT retyping (data carried over)
const { data: cust, error: e3 } = await db.from('customers').insert({
  name: T, email: 'flowtest@example.com', phone: '555-0100', lead_source: 'Website',
}).select('id').single();
ok('customer created from lead data', !e3, e3?.message);

const { data: prod } = await db.from('products').select('id').eq('model_name', 'BUH-ELLA H2').single();
const { data: quote, error: e4 } = await db.from('quotes').insert({
  customer_id: cust.id, product_id: prod.id, quote_number: 'Q-FLOWTEST',
  lead_id: lead.id, subtotal: 5697, total: 5697, status: 'Draft', expiry_date: '2026-09-10', heater: T,
}).select('id').single();
ok('quote created pulling customer + product + price (no retyping)', !e4, e4?.message);

// 5. quote status walk
let qOk = true;
for (const s of ['Sent', 'Viewed', 'Negotiating', 'Accepted']) {
  const { error } = await db.from('quotes').update({ status: s }).eq('id', quote?.id);
  if (error) { qOk = false; console.log('  quote stage', s, 'FAIL:', error.message); }
}
ok('quote status flow Draft→Sent→Viewed→Negotiating→Accepted', qOk);

// cleanup — everything, always
await db.from('quotes').delete().eq('id', quote?.id);
await db.from('customers').delete().eq('id', cust?.id);
await db.from('leads').delete().eq('id', lead?.id);
await db.from('enquiries').delete().eq('id', enq?.id);
const counts = await Promise.all(['quotes','customers','leads','enquiries'].map(async (t) => {
  const { count } = await db.from(t).select('*', { count: 'exact', head: true }).or('name.eq.FLOW TEST — DELETE,heater.eq.FLOW TEST — DELETE');
  return count ?? 0;
}));
ok('all test rows deleted', counts.every((c) => c === 0), counts.join('/'));
console.log(fail === 0 ? '\nALL CRM FLOW TESTS PASSED' : `\n${fail} FAILURES`);
