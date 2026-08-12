/**
 * Structural guards for archive/restore. Run with:  npm test
 *
 * Two things are being protected here.
 *
 * 1. CONSISTENCY. Twelve record types must behave identically. The failure
 *    mode is not a crash — it is customers being archivable while suppliers
 *    are not, or one page still deleting directly. That reads as a bug in the
 *    product long before anyone finds the missing line.
 *
 * 2. THE FALL-THROUGH. Every detail page is shaped
 *      handle the intent → build a payload from the form → UPDATE
 *    An archive POST carries ONLY the intent, so if it reaches the update it
 *    blanks every field on the record it was meant to preserve. That is a
 *    data-loss bug disguised as a missing `if`, and it is invisible in review.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHIVABLE_TABLES } from '../src/lib/archive.ts';

const ADMIN_DIR = fileURLToPath(new URL('../src/pages/admin/', import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.astro')) out.push(full);
  }
  return out;
}
const files = walk(ADMIN_DIR);
const handlerPages = files.filter((f) => readFileSync(f, 'utf8').includes('handleRecordAction('));

test('every archivable table has a detail page wired to the shared handler', () => {
  const wired = new Set<string>();
  for (const f of handlerPages) {
    const src = readFileSync(f, 'utf8');
    const m = src.match(/table:\s*'([a-z_]+)'/);
    if (m) wired.add(m[1]);
  }
  const missing = ARCHIVABLE_TABLES.filter((t) => !wired.has(t));
  assert.deepEqual(missing, [], `no archive/restore wiring for: ${missing.join(', ')}`);
});

test('all twelve record types are covered — the count is pinned', () => {
  // If a table is added to ARCHIVABLE_TABLES, the migration must add its
  // columns too. Pinning the count makes that pairing deliberate.
  assert.equal(ARCHIVABLE_TABLES.length, 12);
});

test('no admin page deletes a business record outside the shared handler', () => {
  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const table of ARCHIVABLE_TABLES) {
      // A direct `.from('customers').delete()` bypasses the admin check AND
      // the must-be-archived precondition.
      if (src.includes(`from('${table}').delete()`)) offenders.push(`${f} → ${table}`);
    }
  }
  assert.deepEqual(offenders, [], 'direct deletes bypassing the guard:\n' + offenders.join('\n'));
});

test('every page using the handler guards its update against fall-through', () => {
  const offenders: string[] = [];
  for (const f of handlerPages) {
    const src = readFileSync(f, 'utf8');
    // Only pages that actually run an update need the guard.
    if (!/\.update\(payload\)/.test(src)) continue;
    if (!src.includes("outcome.kind === 'none'")) offenders.push(f);
  }
  assert.deepEqual(
    offenders,
    [],
    'these pages would run their UPDATE on an archive/restore POST, blanking the record:\n' +
      offenders.join('\n')
  );
});

test('the migration adds columns for exactly the tables the code archives', () => {
  const sql = readFileSync(
    fileURLToPath(new URL('../supabase/migrations/2026-08-12-archive-and-private-documents.sql', import.meta.url)),
    'utf8'
  );
  for (const table of ARCHIVABLE_TABLES) {
    assert.ok(
      new RegExp(`'${table}'`).test(sql),
      `${table} is archivable in code but absent from the migration — its archived_at column would never exist`
    );
  }
});

test('the migration is written to be safe to re-run', () => {
  const sql = readFileSync(
    fileURLToPath(new URL('../supabase/migrations/2026-08-12-archive-and-private-documents.sql', import.meta.url)),
    'utf8'
  );
  assert.ok(sql.includes('add column if not exists'), 'columns must be added idempotently');
  assert.ok(sql.includes('create index if not exists'), 'indexes must be created idempotently');
  // `do nothing` would silently leave an existing bucket public — the exact
  // failure this migration exists to fix.
  assert.ok(
    sql.includes('on conflict (id) do update set public = false'),
    'the bucket upsert must force public = false, not skip on conflict'
  );
});
