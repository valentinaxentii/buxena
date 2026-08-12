import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-auth';
import {
  denyRedirectPath,
  isAdminOnlyPath,
  isAdminRole,
  lookupStaffRole,
} from './lib/staff-access';

/**
 * Gate for every /admin/* route. Astro only invokes middleware for
 * on-demand (non-prerendered) routes — the entire public site stays fully
 * static and never touches this file at all.
 *
 * Which routes are admin-only, and what counts as an admin, live in
 * lib/staff-access.ts so the pages themselves can enforce the same rule
 * (see requireAdmin) rather than trusting this file alone.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isLoginRoute = pathname === '/login';

  if (!isAdminRoute && !isLoginRoute) {
    return next();
  }

  let user = null;
  try {
    const supabase = createSupabaseServerClient(context.request, context.cookies);
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase not configured yet (missing env vars) — treat as logged out
    // rather than throwing, so /login can render its own setup notice.
    user = null;
  }

  if (isAdminRoute && !user) {
    const next = encodeURIComponent(pathname);
    return context.redirect(`/login?next=${next}`);
  }

  if (isLoginRoute && user) {
    return context.redirect('/admin');
  }

  context.locals.staffUser = user;

  // Resolve the role ONCE per admin request and publish it on `locals`. Three
  // consumers share it: this file's admin-only gate below, each page's own
  // requireAdmin()/isAdminStaff() check, and AdminLayout's sidebar. Resolving
  // it here rather than in each of them means one query per request instead of
  // three, and removes any chance of the three disagreeing.
  //
  // A missing profiles row counts as NOT admin (least privilege), and a failed
  // lookup counts as NOT admin either — see lib/staff-access.ts for why that
  // fails closed rather than open.
  if (user && isAdminRoute) {
    const lookup = await lookupStaffRole(user.id);
    context.locals.staffRole = lookup.role;
    context.locals.staffRoleResolved = lookup.resolved;
    context.locals.staffFullName = lookup.fullName;

    if (isAdminOnlyPath(pathname) && !isAdminRole(lookup)) {
      return context.redirect(denyRedirectPath(lookup));
    }
  }

  return next();
});
