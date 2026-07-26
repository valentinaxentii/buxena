/**
 * DATABASE tests for gapless invoice numbering (issue_document_number).
 *
 * ⚠ PRECONDITIONS — read before running:
 *   1. The invoicing migration in supabase/schema.sql must already be applied
 *      to the target database (invoices/document_counters tables + function).
 *   2. This script INSERTS temporary rows and then deletes them. To stay
 *      isolated from any real numbering, every test document is a PROFORMA
 *      dated in the years 2001/2002 — sequences are per (scope, year), so the
 *      real INV/current-year counters are never touched. Cleanup removes the
 *      test invoices AND the PRO-2001/PRO-2002 counter rows it created.
 *
 * Run with:  node scripts/test-invoice-numbering-db.mjs
 *
 * Covers: sequential assignment, concurrent issue attempts, year rollover,
 * and that a failed call consumes no number (transaction rollback).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
const supabase = createClient(get('SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

const TEST_YEARS = [2001, 2002];
const createdIds = [];

async function makeDraft(issueDate) {
  const { data, error } = await supabase
    .from('invoices')
    .insert({ document_type: 'proforma', issue_date: issueDate, notes: 'NUMBERING-TEST — safe to delete' })
    .select('id')
    .single();
  if (error) throw new Error(`draft insert failed: ${error.message}`);
  createdIds.push(data.id);
  return data.id;
}

async function issue(id) {
  return supabase.rpc('issue_document_number', { p_invoice_id: id });
}

async function counterFor(year) {
  const { data } = await supabase
    .from('document_counters')
    .select('last_number')
    .eq('scope', 'PRO')
    .eq('year', year)
    .maybeSingle();
  return data?.last_number ?? 0;
}

async function cleanup() {
  if (createdIds.length) await supabase.from('invoices').delete().in('id', createdIds);
  await supabase.from('document_counters').delete().eq('scope', 'PRO').in('year', TEST_YEARS);
}

try {
  // Guard: refuse to run if test-year counters already hold data
  for (const y of TEST_YEARS) {
    assert.equal(await counterFor(y), 0, `PRO-${y} counter is not empty — aborting rather than disturbing it`);
  }

  // 1. Sequential assignment
  const a = await makeDraft('2001-03-01');
  const b = await makeDraft('2001-03-02');
  const ra = await issue(a);
  const rb = await issue(b);
  assert.equal(ra.error, null);
  assert.equal(rb.error, null);
  assert.equal(ra.data, 'PRO-2001-0001');
  assert.equal(rb.data, 'PRO-2001-0002');
  console.log('✓ sequential assignment');

  // 2. Concurrent issues: no collisions, no gaps
  const drafts = await Promise.all(Array.from({ length: 6 }, () => makeDraft('2001-06-01')));
  const results = await Promise.all(drafts.map((id) => issue(id)));
  const numbers = results.map((r) => {
    assert.equal(r.error, null, r.error?.message);
    return r.data;
  });
  const unique = new Set(numbers);
  assert.equal(unique.size, 6, 'concurrent issues produced a duplicate number');
  const ns = numbers.map((x) => Number(x.slice(-4))).sort((p, q) => p - q);
  assert.deepEqual(ns, [3, 4, 5, 6, 7, 8], `expected consecutive 0003..0008, got ${numbers}`);
  console.log('✓ concurrent issue attempts (6 parallel, consecutive, no gaps)');

  // 3. Year rollover: separate sequence per year, same scope
  const c = await makeDraft('2002-01-15');
  const rc = await issue(c);
  assert.equal(rc.error, null);
  assert.equal(rc.data, 'PRO-2002-0001');
  console.log('✓ year rollover restarts the sequence');

  // 4. A failed call consumes no number (whole function rolls back)
  const before = await counterFor(2001);
  const again = await issue(a); // already issued -> must fail
  assert.notEqual(again.error, null, 'issuing an already-issued invoice should fail');
  assert.equal(await counterFor(2001), before, 'failed issue consumed a number — gapless guarantee broken');
  const d = await makeDraft('2001-09-09');
  const rd = await issue(d);
  assert.equal(rd.data, `PRO-2001-${String(before + 1).padStart(4, '0')}`);
  console.log('✓ failed/rolled-back issue consumes no number');

  console.log('\nALL DB NUMBERING TESTS PASSED');
} finally {
  await cleanup();
  console.log('(test rows and PRO-2001/2002 counters removed)');
}
