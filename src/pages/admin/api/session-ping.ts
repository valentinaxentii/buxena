import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Session keepalive. The work happens BEFORE this handler runs: the auth
 * middleware calls supabase.auth.getUser() for every /admin request, which —
 * via @supabase/ssr — refreshes an expired access token with the refresh
 * token and re-sets the cookies. Hitting this endpoint from an idle-but-
 * visible tab therefore renews the session with no page navigation.
 */
export const GET: APIRoute = () => new Response(null, { status: 204 });
