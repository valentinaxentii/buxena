import { createClient } from '@supabase/supabase-js';

/**
 * Full-access Supabase client using the service_role key — bypasses RLS
 * entirely. NEVER import this file from anything that ships to the browser;
 * it only runs inside `prerender = false` pages/API routes, after
 * middleware.ts has already confirmed a valid staff session exists.
 *
 * The service_role key lives only in Netlify's server-side environment
 * variables — it is never referenced by client-side code, never logged, and
 * never sent in any response.
 */
export function createSupabaseAdminClient() {
  const url = import.meta.env.SUPABASE_URL;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).'
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
