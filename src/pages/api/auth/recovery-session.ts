import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 403,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    const body = await request.json().catch(() => null) as {
      access_token?: unknown;
      refresh_token?: unknown;
      type?: unknown;
    } | null;

    const accessToken = typeof body?.access_token === 'string' ? body.access_token : '';
    const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token : '';
    const type = typeof body?.type === 'string' ? body.type : '';

    if (!accessToken || !refreshToken || type !== 'recovery') {
      return new Response(JSON.stringify({ ok: false }), {
        status: 400,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    const supabase = createSupabaseServerClient(request, cookies);
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error || !data.user) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 401,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
};
