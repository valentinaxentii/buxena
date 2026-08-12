/**
 * Structural guard: every admin handler that permanently deletes a business
 * record must check the caller is an admin first. Run with:  npm test
 *
 * This is a source scan, not a behaviour test, and that is deliberate. The
 * risk is not that the existing twelve handlers stop working — it is that a
 * thirteenth gets added months from now and nobody remembers the rule. A
 * reviewer has to notice a missing line; this notices for them.
 *
 * It also fails if a guard is added but the page forgot to import the helper,
 * which would otherwise be a runtime crash on the delete path only — the one
 * path nobody clicks during ordinary testing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname: on Windows the latter yields "/C:/Users/…",
// which fs then resolves against the drive root as "C:\C:\Users\…".
const ADMIN_DIR = fileURLToPath(new URL('../src/pages/admin/', import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.astro') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/**
 * A record-delete handler, as opposed to a line-item delete. Line items
 * (quote_items, invoice_line_items) are part of editing a record staff are
 * already allowed to edit, and are intentionally NOT admin-gated.
 */
// Matches both spellings in use — `intent === 'delete'` and the inlined
// `String(form.get('_intent')) === 'delete'`. `'delete_item'` does not match,
// which is correct: line-item deletes are not admin-gated.
const RECORD_DELETE = /===\s*'delete'/;

const files = walk(ADMIN_DIR);

test('the scan finds the admin pages at all', () => {
  // Guards against the walk silently returning nothing — a test that scans no
  // files passes forever while checking nothing.
  assert.ok(files.length > 20, `expected many admin files, found ${files.length}`);
  const withDeletes = files.filter((f) => RECORD_DELETE.test(readFileSync(f, 'utf8')));
  assert.ok(withDeletes.length >= 12, `expected >=12 delete handlers, found ${withDeletes.length}`);
});

test('every record-delete handler refuses non-admins', () => {
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!RECORD_DELETE.test(src)) continue;
    if (!src.includes('refuseDelete(Astro)')) offenders.push(file);
  }
  assert.deepEqual(
    offenders,
    [],
    'these pages delete a business record without an admin check:\n' + offenders.join('\n')
  );
});

test('every page that guards a delete also imports the helper', () => {
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('refuseDelete(Astro)')) continue;
    const importsHelper = /import\s*\{[^}]*\brefuseDelete\b[^}]*\}\s*from\s*'[^']*staff-access'/.test(src);
    const definesCanDelete = /const\s+canDelete\s*=\s*await\s+isAdminStaff\(Astro\)/.test(src);
    if (!importsHelper || !definesCanDelete) offenders.push(file);
  }
  assert.deepEqual(
    offenders,
    [],
    'these pages call refuseDelete without importing it or resolving canDelete:\n' +
      offenders.join('\n')
  );
});
