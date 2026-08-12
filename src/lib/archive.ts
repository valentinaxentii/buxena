import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Archive / restore for business records.
 *
 * THE RULE, in one line: archiving is reversible and any staff member may do
 * it; permanent deletion is irreversible, admin-only, and only possible on a
 * record that is already archived.
 *
 * That two-step is the whole point. Permanent deletion used to be one click
 * behind a browser confirm() — the same dialog people dismiss reflexively all
 * day. Now the destructive path cannot even be reached without a separate,
 * earlier, deliberate act, and the record spends that time recoverable.
 *
 * Every table gets the same two columns and the same helpers, so there is no
 * per-record-type behaviour for anyone to remember or for a reviewer to check.
 */

/**
 * Every table with a permanent-delete path. The rule is deliberately simple:
 * anything that can be deleted can be archived. A new deletable record type
 * belongs in this list, and tests/admin-delete-guard.test.ts fails if one is
 * added without its guard.
 */
export const ARCHIVABLE_TABLES = [
  'customers',
  'leads',
  'quotes',
  'orders',
  'suppliers',
  'invoices',
  'documents',
  'products',
  'inventory',
  'shipments',
  'enquiries',
  'supplier_products',
] as const;

export type ArchivableTable = (typeof ARCHIVABLE_TABLES)[number];

export function isArchivableTable(table: string): table is ArchivableTable {
  return (ARCHIVABLE_TABLES as readonly string[]).includes(table);
}

/**
 * Does the database have the archive columns yet?
 *
 * WHY THIS EXISTS: the migration is applied by hand in the Supabase dashboard,
 * so there is a window where this code is running against a database without
 * `archived_at`. Filtering on a column that does not exist does not degrade —
 * PostgREST returns 42703 and the whole list page errors. Every admin list
 * would break at once.
 *
 * So we probe once and adapt: no column means no filtering and no archive
 * controls, exactly the behaviour that existed before this feature. That
 * removes any ordering requirement between shipping the code and running the
 * migration, in either direction.
 *
 * Cached for the life of the process. A serverless instance that started
 * before the migration will keep saying "unsupported" until it is recycled,
 * which is the safe direction to be wrong in: the site behaves as it did
 * yesterday rather than erroring.
 */
let archiveSupport: Promise<boolean> | null = null;

export function resetArchiveSupportCache(): void {
  archiveSupport = null;
}

export function archiveSupported(supabase: SupabaseClient): Promise<boolean> {
  if (!archiveSupport) {
    archiveSupport = (async () => {
      try {
        const { error } = await supabase.from('customers').select('archived_at').limit(1);
        if (!error) return true;
        // 42703 = undefined_column. Anything else (network, permissions) is not
        // evidence the feature is missing, but treating it as missing is the
        // safe answer: it degrades to the previous behaviour instead of
        // breaking the page.
        if (error.code !== '42703') {
          console.error('[archive] support probe failed, assuming unsupported:', error.message);
        }
        return false;
      } catch (e) {
        console.error('[archive] support probe threw:', e instanceof Error ? e.message : e);
        return false;
      }
    })();
  }
  return archiveSupport;
}

/**
 * Apply the active-records filter to a list query.
 *
 * Call it around every list query so archived records drop out of normal
 * views. Pass includeArchived to show ONLY archived ones — the archive view is
 * a separate deliberate destination, not a merged list where an archived
 * record can be mistaken for a live one.
 *
 * A no-op when the migration has not been applied, so callers need no
 * conditional of their own.
 */
export function withArchiveFilter<T>(query: T, supported: boolean, includeArchived: boolean): T {
  if (!supported) return query;
  const q = query as unknown as {
    is: (col: string, val: null) => T;
    not: (col: string, op: string, val: null) => T;
  };
  return includeArchived ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
}

export type ArchiveResult = { ok: true } | { ok: false; error: string };

/** Archive a record. Reversible — see restoreRecord. */
export async function archiveRecord(
  supabase: SupabaseClient,
  table: ArchivableTable,
  id: string,
  staffId: string | null
): Promise<ArchiveResult> {
  if (!isArchivableTable(table)) return { ok: false, error: 'Unknown record type.' };
  const { error } = await supabase
    .from(table)
    .update({ archived_at: new Date().toISOString(), archived_by: staffId })
    .eq('id', id);
  if (error) {
    console.error(`[archive] archiving ${table}/${id} failed:`, error.message);
    return { ok: false, error: 'Could not archive this record. Please try again.' };
  }
  return { ok: true };
}

/** Put an archived record back into the active lists. */
export async function restoreRecord(
  supabase: SupabaseClient,
  table: ArchivableTable,
  id: string
): Promise<ArchiveResult> {
  if (!isArchivableTable(table)) return { ok: false, error: 'Unknown record type.' };
  const { error } = await supabase
    .from(table)
    .update({ archived_at: null, archived_by: null })
    .eq('id', id);
  if (error) {
    console.error(`[archive] restoring ${table}/${id} failed:`, error.message);
    return { ok: false, error: 'Could not restore this record. Please try again.' };
  }
  return { ok: true };
}

/**
 * Server-side precondition for permanent deletion: the record must already be
 * archived.
 *
 * Enforced HERE, not in the template. Hiding the delete button on an active
 * record is a courtesy; this is the control. Returns false when the record is
 * active, missing, or unreadable — every uncertain case refuses, because the
 * action it guards cannot be undone.
 *
 * Before the migration is applied there is no archived_at column and therefore
 * no way to satisfy the precondition, so permanent deletion is simply
 * unavailable until then. That is the correct failure direction.
 */
export async function isArchived(
  supabase: SupabaseClient,
  table: ArchivableTable,
  id: string
): Promise<boolean> {
  if (!isArchivableTable(table)) return false;
  if (!(await archiveSupported(supabase))) return false;
  try {
    const { data, error } = await supabase
      .from(table)
      .select('archived_at')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return false;
    return Boolean((data as { archived_at?: string | null }).archived_at);
  } catch {
    return false;
  }
}

/**
 * The single wording used wherever a permanent delete is refused because the
 * record is still active.
 */
export const DELETE_REQUIRES_ARCHIVE =
  'Archive this record first. Permanent deletion is only possible on an archived record, so nothing is destroyed in one step.';
