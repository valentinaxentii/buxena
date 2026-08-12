/**
 * Structural guard: permanent deletion of a business record is admin-only and
 * only possible on an already-archived record. Run with:  npm test
 *
 * This started life checking that each of twelve detail pages carried its own
 * admin check. Those twelve copies have since been replaced by one shared
 * handler, so the invariant moved: the check is no longer "every page checks"
 * but "no page can delete without going through the thing that checks".
 *
 * The test was rewritten rather than deleted. The risk it guards is unchanged
 * — an irreversible action reachable without authorisation — only the shape of
 * the code changed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const HANDLER = join(SRC, 'lib', 'record-actions.ts');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.astro') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

test('the scan finds the source at all', () => {
  // A scan that silently matches nothing passes forever while checking nothing.
  const files = walk(SRC);
  assert.ok(files.length > 50, `expected many source files, found ${files.length}`);
});

test('refuseDelete is only ever called from the shared handler', () => {
  const offenders: string[] = [];
  for (const file of walk(SRC)) {
    if (file === HANDLER) continue;
    if (readFileSync(file, 'utf8').includes('refuseDelete(Astro)')) offenders.push(file);
  }
  assert.deepEqual(
    offenders,
    [],
    'the admin check belongs in lib/record-actions.ts alone; these call it directly:\n' +
      offenders.join('\n')
  );
});

test('the handler refuses a non-admin before deleting anything', () => {
  const src = readFileSync(HANDLER, 'utf8');
  const guardAt = src.indexOf('if (!ctx.canDelete)');
  const deleteAt = src.indexOf('.delete()');
  assert.ok(guardAt !== -1, 'the admin check is missing from the shared handler');
  assert.ok(deleteAt !== -1, 'the delete call is missing from the shared handler');
  assert.ok(guardAt < deleteAt, 'the admin check must come BEFORE the delete');
});

test('the handler refuses an unarchived record before deleting anything', () => {
  const src = readFileSync(HANDLER, 'utf8');
  const archivedAt = src.indexOf('await isArchived(');
  const deleteAt = src.indexOf('.delete()');
  assert.ok(archivedAt !== -1, 'the must-be-archived precondition is missing');
  assert.ok(archivedAt < deleteAt, 'the archived check must come BEFORE the delete');
});

test('an uncertain archive state refuses rather than permits', () => {
  // isArchived returns false on a missing row, a read error, or a database
  // without the column. Each of those must block the irreversible action.
  const src = readFileSync(join(SRC, 'lib', 'archive.ts'), 'utf8');
  assert.match(
    src,
    /if \(error \|\| !data\) return false;/,
    'a failed or empty read must return false (refuse), never true'
  );
  assert.match(
    src,
    /if \(!\(await archiveSupported\(supabase\)\)\) return false;/,
    'no archive column means nothing can be archived, so nothing can be deleted'
  );
});
