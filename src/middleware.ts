import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-auth';
import { createSupabaseAdminClient } from './lib/supabase-admin';

/**
 * Routes only an admin-role profile may open. Everything else under /admin
 * is available to any authenticated staff account. Settings covers both
 * business configuration and staff account management.
 */
const ADMIN_ONLY_PREFIXES = ['/admin/settings'];

/**
 * Gate for every /admin/* route. Astro only invokes middleware for
 * on-demand (non-prerendered) routes — the entire public site stays fully
 * static and never touches this file at all.
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

  // Admin-only routes fail closed. Missing profiles, lookup errors, missing
  // schema/configuration, and any other role-resolution failure are denied.
  // Sensitive pages also perform their own independent authorization check.
  if (user && ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    let role: string | null = null;
    try {
      const admin = createSupabaseAdminClient();
      const { data: profile, error } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!error) role = profile?.role ?? null;
    } catch {
      role = null;
    }
    context.locals.staffRole = role;
    if (role !== 'admin') {
      return context.redirect('/admin?denied=settings');
    }
  }

  return next();
});
