import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';

export const prerender = false;

/**
 * Public-facing endpoint the Sauna Advisor (and, later, other site forms)
 * calls to record an enquiry. Uses the service-role client server-side only
 * — the browser never sees a Supabase key, it just POSTs a small JSON body
 * here. Best-effort: the chat widget fires this in the background and does
 * not depend on it succeeding, so a missing/unconfigured Supabase project
 * never breaks the visitor-facing chat experience.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, phone, location, message, chatTranscript, saunaInterest, source } = body ?? {};

    if (!message && !(chatTranscript && chatTranscript.length)) {
      return new Response(JSON.stringify({ ok: false, error: 'Nothing to record.' }), { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from('enquiries').insert({
      name: name || null,
      email: email || null,
      phone: phone || null,
      location: location || null,
      message: message || null,
      chat_transcript: chatTranscript || null,
      sauna_interest: saunaInterest || null,
      source: source || 'Sauna Advisor',
      status: 'New',
    });

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500 }
    );
  }
};
