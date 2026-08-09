import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import { sendEnquiryEmail } from '../../lib/send-enquiry-email';
import { checkRateLimit } from '../../lib/rate-limit';

export const prerender = false;

/**
 * Public-facing endpoint the Sauna Advisor (and, later, other site forms)
 * calls to record an enquiry. Uses the service-role client server-side only
 * — the browser never sees a Supabase key, it just POSTs a small JSON body
 * here. Best-effort: the chat widget fires this in the background and does
 * not depend on it succeeding, so a missing/unconfigured Supabase project
 * never breaks the visitor-facing chat experience.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  // A real visitor sends this at most once or twice per visit (one chat
  // conversation, maybe the quote form too). 5 per 10 minutes leaves that
  // headroom while still cutting off a script hammering the endpoint.
  const { allowed, retryAfterSeconds } = checkRateLimit(`enquiries:${clientAddress}`, 5, 10 * 60_000);
  if (!allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Too many requests. Please try again shortly.' }), {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
  }

  try {
    const body = await request.json();
    const { name, email, phone, location, message, chatTranscript, saunaInterest, source, botField } =
      body ?? {};

    // Honeypot: a real visitor never fills the hidden field. Bots that blindly
    // complete every input do. Pretend success and drop it — don't record, don't
    // email, don't tip off the bot. Replaces the spam filtering Netlify Forms
    // used to provide before this became the single submission path.
    if (botField) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (!message && !(chatTranscript && chatTranscript.length)) {
      return new Response(JSON.stringify({ ok: false, error: 'Nothing to record.' }), { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: inserted, error } = await supabase
      .from('enquiries')
      .insert({
        name: name || null,
        email: email || null,
        phone: phone || null,
        location: location || null,
        message: message || null,
        chat_transcript: chatTranscript || null,
        sauna_interest: saunaInterest || null,
        source: source || 'Sauna Advisor',
        status: 'New',
      })
      .select('id')
      .single();

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }

    // Audit trail entry. Awaited (not fire-and-forget) so the serverless
    // function doesn't freeze before the write lands, but its failure is
    // swallowed — it must never turn a recorded enquiry into an error.
    if (inserted) {
      await supabase
        .from('activities')
        .insert({
          entity_type: 'enquiry',
          entity_id: inserted.id,
          activity_type: 'note',
          description: `Enquiry received — ${source || 'Sauna Advisor'}`,
        })
        .then(
          () => {},
          (err) => console.error('[enquiries] activity log failed:', err)
        );
    }

    // Email notification to info@buxena.com. Awaited so the request reliably
    // completes the send before the function returns (fire-and-forget can be
    // killed mid-flight in serverless). Best-effort: a send failure is logged
    // but never fails the submission — the enquiry is already safely recorded.
    try {
      await sendEnquiryEmail({ name, email, phone, location, message, saunaInterest, source });
    } catch (err) {
      console.error('[enquiries] email notify failed:', err);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500 }
    );
  }
};
