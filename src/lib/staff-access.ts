import type { AstroGlobal } from 'astro';
import { createSupabaseAdminClient } from './supabase-admin';

/**
 * Single source of truth for "who may open what" in the back office.
 *
 * Two layers use it, deliberately:
 *   1. src/middleware.ts  — gates every /admin/* request before a page runs.
 *   2. the admin-only pages themselves — call `requireAdmin()` in frontmatter.
 *
 * The second layer is not redundant. The middleware authorises by URL prefix,
 * so a new admin-only route added without updating ADMIN_ONLY_PREFIXES would
 * silently be open to every staff account. A page that asks for itself cannot
 * be forgotten.
 *
 * FAIL CLOSED: if the role cannot be established — the lookup errors, the
 * profiles table is missing, there is no row for this user — access is
 * DENIED, never granted. An earlier version allowed the request through on a
 * lookup failure so a half-configured project could still reach Settings;
 * that turned any transient Supabase error into a path for a staff account to
 * open Staff Accounts and promote itself to admin. Reaching setup notices is
 * not worth a privilege-escalation window, and the bootstrap path
 * (supabase/seed-profiles.mjs, then promote in the Supabase dashboard) does
 * not depend on the UI.
 */

/** Route prefixes only an `admin` profile may open. */
export const ADMIN_ONLY_PREFIXES = ['/admin/settings'];

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export type StaffRoleLookup = {
  /** The stored role, or null when unknown (missing row, or the lookup failed). */
  role: string | null;
  /** True only when the lookup completed. False means "we do not know". */
  resolved: boolean;
  /** Display name from the profile, when there is one. */
  fullName: string | null;
};

/**
 * Read a staff member's role with the service-role client. Never throws —
 * every failure resolves to `{ role: null, resolved: false }`, which every
 * caller must treat as "not authorised".
 */
export async function lookupStaffRole(userId: string): Promise<StaffRoleLookup> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('[staff-access] role lookup failed:', error.message);
      return { role: null, resolved: false, fullName: null };
    }
    const row = data as { role?: string; full_name?: string } | null;
    return { role: row?.role ?? null, resolved: true, fullName: row?.full_name ?? null };
  } catch (e) {
    console.error('[staff-access] role lookup threw:', e instanceof Error ? e.message : e);
    return { role: null, resolved: false, fullName: null };
  }
}

export function isAdminRole(lookup: StaffRoleLookup): boolean {
  return lookup.resolved && lookup.role === 'admin';
}

/**
 * Reason codes carried to the dashboard so the person sees why they were sent
 * back, instead of a silent bounce. Kept short — they appear in the URL.
 */
export type DenyReason = 'settings' | 'settings-unverified';

export function denyRedirectPath(lookup: StaffRoleLookup): string {
  const reason: DenyReason = lookup.resolved ? 'settings' : 'settings-unverified';
  return `/admin?denied=${reason}`;
}

/**
 * Page-level guard — defence in depth behind the middleware.
 *
 * Call FIRST in the frontmatter of any admin-only page, before it reads or
 * writes anything:
 *
 *   const denied = await requireAdmin(Astro);
 *   if (denied) return denied;
 *
 * Returns a redirect Response when the caller is not a confirmed admin, or
 * null when they are. Reuses the role the middleware already resolved onto
 * `locals`, so the common path costs no extra query.
 */
export async function requireAdmin(astro: AstroGlobal): Promise<Response | null> {
  const user = astro.locals.staffUser;
  if (!user) {
    // Should be unreachable — the middleware redirects anonymous callers —
    // but an unauthenticated request must never fall through to admin work.
    return astro.redirect(`/login?next=${encodeURIComponent(astro.url.pathname)}`);
  }

  const lookup = await resolveStaffRole(astro);
  if (!isAdminRole(lookup)) return astro.redirect(denyRedirectPath(lookup));
  return null;
}

/**
 * The role for this request, from `locals` when the middleware already put it
 * there (every /admin route), otherwise looked up. Never throws.
 */
export async function resolveStaffRole(astro: AstroGlobal): Promise<StaffRoleLookup> {
  if (astro.locals.staffRoleResolved !== undefined) {
    return {
      role: astro.locals.staffRole ?? null,
      resolved: astro.locals.staffRoleResolved,
      fullName: astro.locals.staffFullName ?? null,
    };
  }
  const user = astro.locals.staffUser;
  if (!user) return { role: null, resolved: true, fullName: null };
  return lookupStaffRole(user.id);
}

/**
 * Boolean form of the admin check, for pages that must stay open to staff but
 * gate ONE action inside them — permanent deletion of a business record.
 *
 * Use it in BOTH places on such a page: to decide whether to run the action,
 * and to decide whether to render its button. The server-side check is the
 * real control; hiding the button only stops staff being offered something
 * that would be refused.
 */
export async function isAdminStaff(astro: AstroGlobal): Promise<boolean> {
  return isAdminRole(await resolveStaffRole(astro));
}

/**
 * The single refusal message for a delete blocked by role. One wording, so a
 * staff member sees the same explanation wherever they hit it.
 */
export const DELETE_REQUIRES_ADMIN =
  'Only an admin can permanently delete this record. Ask an admin to do it, or archive it instead.';

/**
 * Refuse a delete and send the person back to the record they were on.
 *
 * Deliberately a redirect and not "set an error variable and continue": every
 * one of these handlers is shaped
 *
 *   if (intent === 'delete') { …delete…; return redirect(list) }
 *   const payload = { …read every field from the form… }
 *   await supabase.update(payload)
 *
 * so falling through from a refused delete would run the UPDATE branch against
 * a form that contains only the delete intent — blanking every field on the
 * record. Refusing a deletion must never damage the thing it protected.
 * Returning here makes that structurally impossible.
 */
export function refuseDelete(astro: AstroGlobal): Response {
  return astro.redirect(`${astro.url.pathname}?denied=delete`);
}

/** True when this request is a bounce from refuseDelete(). */
export function wasDeleteRefused(astro: AstroGlobal): boolean {
  return astro.url.searchParams.get('denied') === 'delete';
}
