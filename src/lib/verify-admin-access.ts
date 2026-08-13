import type { AstroCookies } from 'astro';
import { createSupabaseServerClient } from './supabase-auth';
import { createSupabaseAdminClient } from './supabase-admin';

/**
 * Defense-in-depth authorization for admin-only server routes/pages.
 *
 * This intentionally fails closed: any missing session, missing profile,
 * non-admin role, schema/configuration error, or Supabase failure returns false.
 * Callers must deny access when this function is false.
 */
export async function verifyAdminAccess(request: Request, cookies: AstroCookies): Promise<boolean> {
  try {
    const auth = createSupabaseServerClient(request, cookies);
    const { data: { user }, error: userError } = await auth.auth.getUser();
    if (userError || !user) return false;

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) return false;
    return profile?.role === 'admin';
  } catch {
    return false;
  }
}
