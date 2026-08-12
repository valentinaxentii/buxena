import type { AstroGlobal } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  archiveRecord,
  archiveSupported,
  isArchived,
  restoreRecord,
  DELETE_REQUIRES_ARCHIVE,
  type ArchivableTable,
} from './archive.ts';
import { refuseDelete } from './staff-access.ts';

/**
 * The one place archive / restore / permanent-delete are handled, for every
 * record type.
 *
 * Twelve detail pages used to each carry their own delete branch. Twelve
 * copies of a security-critical decision is twelve chances to drift, and the
 * drift is invisible until someone deletes something they should not have
 * been able to. One implementation, called identically everywhere, is the
 * whole design goal here.
 *
 * ORDER OF CHECKS for a permanent delete, all server-side:
 *   1. Is the caller an admin?            — no: bounce, never delete
 *   2. Is the record already archived?    — no: refuse, tell them to archive
 *   3. Delete.
 *
 * Neither check is in the template. The buttons are hidden to match, but
 * hiding a button only stops it being offered; these are what stop it working.
 */

export type RecordActionOutcome =
  | { kind: 'response'; response: Response }
  | { kind: 'error'; message: string }
  | { kind: 'notice'; message: string }
  | { kind: 'none' };

export interface RecordActionContext {
  supabase: SupabaseClient;
  table: ArchivableTable;
  id: string;
  /** Result of isAdminStaff(Astro) — resolved by the caller once per request. */
  canDelete: boolean;
  /** Where to go after a successful permanent delete, e.g. '/admin/customers'. */
  listPath: string;
  /**
   * Optional extra work to run immediately before a permanent delete, for
   * record types that must release something first (an order returning its
   * reserved unit, a document removing its stored file). Runs ONLY after both
   * authorisation checks have passed.
   */
  beforeDelete?: () => Promise<void>;
  /**
   * Optional cleanup after a successful permanent delete — releasing stock an
   * order was holding, removing the stored file behind a document row. Kept
   * separate from beforeDelete because some of this work is only correct once
   * the row is actually gone, and none of it should run if the delete failed.
   */
  afterDelete?: () => Promise<void>;
}

export async function handleRecordAction(
  astro: AstroGlobal,
  form: FormData,
  ctx: RecordActionContext
): Promise<RecordActionOutcome> {
  const intent = String(form.get('_intent') ?? '');
  if (intent !== 'archive' && intent !== 'restore' && intent !== 'delete') {
    return { kind: 'none' };
  }

  const staffId = astro.locals.staffUser?.id ?? null;

  if (intent === 'archive') {
    // Reversible, so any signed-in staff member may do it. This is the action
    // people should reach for; permanent deletion is the exception.
    const result = await archiveRecord(ctx.supabase, ctx.table, ctx.id, staffId);
    return result.ok
      ? { kind: 'notice', message: 'Archived. It is out of the active lists and can be restored at any time.' }
      : { kind: 'error', message: result.error };
  }

  if (intent === 'restore') {
    const result = await restoreRecord(ctx.supabase, ctx.table, ctx.id);
    return result.ok
      ? { kind: 'notice', message: 'Restored to the active list.' }
      : { kind: 'error', message: result.error };
  }

  // ---- permanent delete ----
  if (!ctx.canDelete) {
    // Redirect rather than fall through: see refuseDelete for why returning
    // here is load-bearing rather than stylistic.
    return { kind: 'response', response: refuseDelete(astro) };
  }

  if (!(await isArchived(ctx.supabase, ctx.table, ctx.id))) {
    // Covers three cases that all deserve the same refusal: the record is
    // active, it does not exist, or the archive migration has not been applied
    // so nothing can satisfy the precondition.
    return { kind: 'error', message: DELETE_REQUIRES_ARCHIVE };
  }

  if (ctx.beforeDelete) await ctx.beforeDelete();

  const { error } = await ctx.supabase.from(ctx.table).delete().eq('id', ctx.id);
  if (error) {
    console.error(`[record-actions] deleting ${ctx.table}/${ctx.id} failed:`, error.message);
    return { kind: 'error', message: 'Could not delete this record. Please try again.' };
  }

  if (ctx.afterDelete) await ctx.afterDelete();

  return { kind: 'response', response: astro.redirect(ctx.listPath) };
}

/**
 * Everything a detail page needs to render its actions consistently.
 * Resolved once per request alongside the record itself.
 */
export async function recordActionState(
  supabase: SupabaseClient,
  record: { archived_at?: string | null } | null
): Promise<{ supported: boolean; archived: boolean }> {
  const supported = await archiveSupported(supabase);
  return { supported, archived: Boolean(record?.archived_at) };
}
