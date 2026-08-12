import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import { sendEnquiryEmail } from '../../lib/send-enquiry-email';
import { sendCustomerAckEmail, buildCustomerAckEmail } from '../../lib/send-customer-ack';
import { sendEnquiryTelegram } from '../../lib/notify-telegram';
import { checkRateLimit } from '../../lib/rate-limit';
import { decideEnquiryOutcome, wasDelivered } from '../../lib/enquiry-capture';

export const prerender = false;

/**
 * The single message any server-side failure returns to the public. Never
 * echo a Supabase, SMTP or environment error to a visitor: it leaks schema
 * and configuration, and it tells the person nothing they can act on. It
 * keeps a route open for the lead — a sale must not be lost to a 500.
 */
const SUBMISSION_FAILED =
  "We couldn't record that just now. Please try again, or email info@buxena.com and we'll pick it up from there.";

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
  // Skipped in local dev-mode testing (which never reaches production
  // services anyway) so a founder can click through every form in a row.
  const devTestMode = import.meta.env.DEV && process.env.ENQUIRIES_DEV_LIVE !== 'true';
  if (!devTestMode) {
    const { allowed, retryAfterSeconds } = checkRateLimit(`enquiries:${clientAddress}`, 5, 10 * 60_000);
    if (!allowed) {
      return new Response(JSON.stringify({ ok: false, error: 'Too many requests. Please try again shortly.' }), {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      });
    }
  }

  try {
    const body = await request.json();
    const { name, email, phone, location, message, chatTranscript, saunaInterest, source, attribution, botField } =
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

    // Server-side sanity checks mirroring the client validation — the
    // client can be bypassed, the server cannot.
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email))) {
      return new Response(JSON.stringify({ ok: false, error: 'Please enter a valid email address.' }), { status: 400 });
    }

    // LOCAL DEV MODE — never touches production services. In `astro dev`
    // the submission is validated, logged locally (never the secrets — there
    // are none in this payload), and acknowledged with devMode:true so the
    // UI can show its "local test mode" success state. Forms stay fully
    // testable with no .env at all. To exercise the real pipeline from a dev
    // server against an explicitly-chosen safe environment, set
    // ENQUIRIES_DEV_LIVE=true alongside the Supabase vars.
    if (import.meta.env.DEV && process.env.ENQUIRIES_DEV_LIVE !== 'true') {
      console.log('[enquiries][dev] captured local test submission:', {
        name,
        email,
        phone,
        location,
        saunaInterest,
        source,
        message,
      });
      // Preview the customer acknowledgment this submission would trigger in
      // production (nothing is sent in dev — this is the generated content).
      const ackPreview = buildCustomerAckEmail({ name, email, location, message, saunaInterest, source });
      console.log(
        ackPreview
          ? `[enquiries][dev] customer ack would send — subject: "${ackPreview.subject}"\n${ackPreview.text}`
          : '[enquiries][dev] customer ack would NOT send (no email address, or enrichment submission).'
      );
      return new Response(JSON.stringify({ ok: true, devMode: true }), { status: 200 });
    }

    // PRODUCTION — two INDEPENDENT capture paths, in this order:
    //   1. the database row (the system of record)
    //   2. the staff email + Telegram (a human who can act on it)
    //
    // Neither is allowed to take the other down. A failed insert used to
    // return 500 immediately, which skipped the notifications too — so a
    // Supabase outage silently destroyed every lead that arrived during it,
    // with no copy anywhere and a visitor told to "try again". For a business
    // whose entire funnel ends in one of these forms, losing the lead is the
    // most expensive possible failure. The write is now best-effort and the
    // request continues either way.
    let recorded = false;
    let inserted: { id: string } | null = null;
    let supabase: ReturnType<typeof createSupabaseAdminClient> | null = null;
    try {
      supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
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
        // Log the real cause server-side; the visitor never sees it. Supabase
        // error text names tables, columns and constraints — free schema
        // reconnaissance for anyone probing a public endpoint, and meaningless
        // to the person who triggered it.
        console.error('[enquiries] insert failed, falling back to notifications:', error.message);
      } else {
        recorded = true;
        inserted = data as { id: string };
      }
    } catch (e) {
      // Covers createSupabaseAdminClient() throwing on missing env vars, and
      // any network failure reaching the database.
      console.error(
        '[enquiries] database unavailable, falling back to notifications:',
        e instanceof Error ? e.message : e
      );
    }

    // Audit trail entry. Awaited (not fire-and-forget) so the serverless
    // function doesn't freeze before the write lands, but its failure is
    // swallowed — it must never turn a recorded enquiry into an error.
    if (inserted && supabase) {
      const cleanAttribution = (key: string) => {
        const value = attribution && typeof attribution === 'object' ? (attribution as Record<string, unknown>)[key] : null;
        return typeof value === 'string' ? value.trim().slice(0, 300) : '';
      };
      const attributionDetails = [
        ['landing page', cleanAttribution('landingPath')],
        ['referrer', cleanAttribution('referrerHost')],
        ['utm source', cleanAttribution('utmSource')],
        ['utm medium', cleanAttribution('utmMedium')],
        ['utm campaign', cleanAttribution('utmCampaign')],
        ['utm content', cleanAttribution('utmContent')],
        ['utm term', cleanAttribution('utmTerm')],
      ].filter(([, value]) => Boolean(value)).map(([label, value]) => `${label}: ${value}`);
      await supabase
        .from('activities')
        .insert({
          entity_type: 'enquiry',
          entity_id: inserted.id,
          activity_type: 'note',
          description: `Enquiry received — ${source || 'Sauna Advisor'}${attributionDetails.length ? ` | ${attributionDetails.join(' · ')}` : ''}`,
        })
        .then(
          () => {},
          (err) => console.error('[enquiries] activity log failed:', err)
        );
    }

    // Notifications: email to info@buxena.com, plus a Telegram message to the
    // founders' group. Both awaited so the request reliably completes them
    // before the function returns (fire-and-forget can be killed mid-flight in
    // serverless), and run concurrently so the slower one does not add its
    // latency to the faster one. allSettled, not all: each is independently
    // best-effort, and one failing must not skip the other.
    //
    // `unrecorded` tells both messages to stop claiming the enquiry is "also
    // in Admin" and to say plainly that they are the only copy — a staff
    // notification that lies about where the data is, is worse than none.
    const notify = { name, email, phone, location, message, saunaInterest, source };
    const staffNotify = { ...notify, unrecorded: !recorded };

    // The customer acknowledgment promises a human will follow up, so it may
    // only go out once we know somebody actually received the lead. On the
    // normal path `recorded` is already true, so all three still run
    // concurrently and this costs nothing; only a failed database write makes
    // the ack wait for the staff notifications to report back.
    const sendAck = () =>
      sendCustomerAckEmail(notify).catch((err) => {
        console.error('[enquiries] customer ack failed:', err);
        throw err;
      });

    const [emailResult, telegramResult, eagerAck] = await Promise.allSettled([
      sendEnquiryEmail(staffNotify),
      sendEnquiryTelegram(staffNotify),
      // The module itself skips enrichment submissions ("Quote Form —
      // details"), so one visitor journey can never receive two
      // acknowledgments.
      recorded ? sendAck() : Promise.resolve('deferred' as const),
    ]);
    if (emailResult.status === 'rejected') {
      console.error('[enquiries] email notify failed:', emailResult.reason);
    }
    if (telegramResult.status === 'rejected') {
      console.error('[enquiries] telegram notify failed:', telegramResult.reason);
    }
    if (eagerAck.status === 'rejected') {
      console.error('[enquiries] customer ack failed:', eagerAck.reason);
    }

    const decision = decideEnquiryOutcome({
      recorded,
      emailDelivered: wasDelivered(emailResult),
      telegramDelivered: wasDelivered(telegramResult),
    });

    if (!recorded && decision.shouldAcknowledge) {
      // The database is down but staff have the lead — the acknowledgment's
      // promise of follow-up is now true, so send it.
      await sendAck().catch(() => {});
    }

    if (!decision.captured) {
      // Nothing worked: no row, no email, no Telegram. This is the only case
      // where the visitor must be asked to try again, because this is the
      // only case where nobody has their details.
      console.error('[enquiries] LEAD LOST — database, email and Telegram all failed');
      return new Response(JSON.stringify({ ok: false, error: SUBMISSION_FAILED }), {
        status: decision.status,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: decision.status });
  } catch (e) {
    // Same rule as above: the visitor gets one honest, actionable sentence,
    // the detail goes to the function log. This catch also covers
    // createSupabaseAdminClient() throwing on missing env vars — a message
    // that names our environment variables and belongs in the log, not in a
    // public HTTP response.
    console.error('[enquiries] submission failed:', e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ ok: false, error: SUBMISSION_FAILED }), { status: 500 });
  }
};
