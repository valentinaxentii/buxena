import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

/**
 * Session-bound Supabase client for a single request — reads/writes the
 * auth cookies via Astro's cookie API. Use this ONLY for auth operations
 * (signInWithPassword, getUser, signOut). It runs with the anon key and is
 * subject to RLS, which only grants read access — see supabase/schema.sql.
 * Actual admin data reads/writes go through `supabase-admin.ts` instead,
 * after this client has confirmed there's a valid session.
 */
export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
  const url = import.meta.env.SUPABASE_URL;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY (see .env.example).'
    );
  }

  const cookieOptions: CookieOptionsWithName = {
    path: '/',
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    httpOnly: true,
  };

  return createServerClient(url, anonKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, { ...cookieOptions, ...options });
        });
      },
    },
  });
}

function parseCookieHeader(header: string) {
  if (!header) return [];
  return header.split(';').map((pair) => {
    const index = pair.indexOf('=');
    const name = (index > -1 ? pair.slice(0, index) : pair).trim();
    const value = index > -1 ? pair.slice(index + 1).trim() : '';
    return { name, value: decodeURIComponent(value) };
  });
}
