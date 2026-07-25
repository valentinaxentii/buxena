import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    const supabase = createSupabaseServerClient(request, cookies);
    await supabase.auth.signOut();
  } catch {
    // Not configured / already signed out — fall through to redirect either way.
  }
  return redirect('/login');
};
