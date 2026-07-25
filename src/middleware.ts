import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-auth';

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
  return next();
});
