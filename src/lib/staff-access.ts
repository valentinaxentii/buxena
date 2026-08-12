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
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('[staff-access] role lookup failed:', error.message);
      return { role: null, resolved: false };
    }
    return { role: (data as { role?: string } | null)?.role ?? null, resolved: true };
  } catch (e) {
    console.error('[staff-access] role lookup threw:', e instanceof Error ? e.message : e);
    return { role: null, resolved: false };
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

  const lookup: StaffRoleLookup =
    astro.locals.staffRoleResolved === undefined
      ? await lookupStaffRole(user.id)
      : { role: astro.locals.staffRole ?? null, resolved: astro.locals.staffRoleResolved };

  if (!isAdminRole(lookup)) return astro.redirect(denyRedirectPath(lookup));
  return null;
}
