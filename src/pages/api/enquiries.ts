import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import { sendEnquiryEmail } from '../../lib/send-enquiry-email';
import { sendCustomerAckEmail, buildCustomerAckEmail } from '../../lib/send-customer-ack';
import { sendEnquiryTelegram } from '../../lib/notify-telegram';
import { checkRateLimit } from '../../lib/rate-limit';
import { decideEnquiryOutcome, wasDelivered } from '../../lib/enquiry-capture';
import { checkOptionalZip } from '../../lib/zip';
import { isLeadSafeMode, safeModeReason } from '../../lib/safe-mode';
import { FALLBACK_SOURCE, isSourceConstraintError, withFormLine } from '../../lib/enquiry-source';

export const prerender = false;
const INTERNAL_ERROR = 'We could not submit your request right now. Please try again shortly.';
const MAX_BODY_BYTES = 64 * 1024;

type EnquiryDbSource = 'Website' | 'Sauna Advisor' | 'Contact Form' | 'Quote Form' | 'Other';

function normalizeDbSource(source: unknown): EnquiryDbSource {
  const label = typeof source === 'string' ? source.trim() : '';
  if (label === 'Website') return 'Website';
  if (label === 'Sauna Advisor') return 'Sauna Advisor';
  if (label === 'Contact Form' || label.toLowerCase().includes('contact')) return 'Contact Form';
  if (label === 'Quote Form' || label.startsWith('Quote Form') || label === 'Quote Comparison') return 'Quote Form';
  return 'Other';
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

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
  // Reject an oversized body BEFORE parsing it. The field caps further down
  // truncate after JSON.parse has already built the value in memory, so
  // without this a single huge post still had to be read and parsed first.
  // From the remote line of work, which reached this independently.
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ ok: false, error: 'Request is too large.' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // A real visitor sends this at most once or twice per visit (one chat
  // conversation, maybe the quote form too). 5 per 10 minutes leaves that
  // headroom while still cutting off a script hammering the endpoint.
  // Skipped in local dev-mode testing (which never reaches production
  // services anyway) so a founder can click through every form in a row.
  const devTestMode = isLeadSafeMode();
  if (!devTestMode) {
    const { allowed, retryAfterSeconds } = checkRateLimit(`enquiries:${clientAddress}`, 5, 10 * 60_000);
    if (!allowed) {
      return new Response(JSON.stringify({ ok: false, error: 'Too many requests. Please try again shortly.' }), {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds), 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const body = await request.json();
    const {
      name, email, phone, location, zip, message, chatTranscript, saunaInterest, source, attribution, botField,
      appendToEnquiryId,
    } = body ?? {};

    /**
     * Field length ceilings.
     *
     * Nothing enforced a length on any field: `message`, `name` and `source`
     * went to the database exactly as posted, so a single request could store
     * megabytes and the 5-per-10-minutes rate limit was the only bound on how
     * often. `source` mattered most — it used to be pinned to five values by a
     * CHECK constraint, and relaxing that constraint (so the nine forms it was
     * silently rejecting could record at all) also removed the only thing
     * keeping it short.
     *
     * Generous on purpose: these are far above anything a real customer types,
     * so they cost a genuine enquiry nothing. Truncating beats rejecting — a
     * long message is still a lead, and a 400 here would lose it.
     */
    const cap = (value: unknown, max: number): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed ? trimmed.slice(0, max) : null;
    };

    const safe = {
      name: cap(name, 200),
      // Lower-cased so a returning customer matches themselves: the admin's
      // "Also from this contact" panel, duplicate detection and customer
      // lookup all key on this, and Jane@x.com would otherwise be a
      // different person from jane@x.com. From the remote line.
      email: cap(email, 320)?.toLowerCase() ?? null, // RFC 5321 maximum
      phone: cap(phone, 50),
      location: cap(location, 200),
      message: cap(message, 8000),
      saunaInterest: cap(saunaInterest, 200),
      source: cap(source, 60),
    };

    /**
     * The chat transcript is jsonb, so it had no ceiling at all — the widest
     * opening here, since the browser controls both how many messages it sends
     * and how long each one is. Kept whole for any real conversation; a
     * conversation longer than 200 turns is not a lead.
     */
    const safeTranscript = Array.isArray(chatTranscript)
      ? chatTranscript.slice(0, 200).map((entry: any) => ({
          role: entry?.role === 'user' ? 'user' : 'bot',
          text: cap(entry?.text, 2000) ?? '',
        }))
      : null;

    // The id of an enquiry this submission should be MERGED INTO rather than
    // recorded beside. Only the quote form's optional second step sends it,
    // carrying the id step 1 returned. Validated as a uuid here so a malformed
    // or hostile value is ignored outright rather than reaching a query.
    const appendId =
      typeof appendToEnquiryId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appendToEnquiryId)
        ? appendToEnquiryId
        : null;

    if (botField) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (!message && !(chatTranscript && chatTranscript.length)) return new Response(JSON.stringify({ ok: false, error: 'Nothing to record.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return new Response(JSON.stringify({ ok: false, error: 'Please enter a valid email address.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    if (!message && !(chatTranscript && chatTranscript.length)) {
      return new Response(JSON.stringify({ ok: false, error: 'Nothing to record.' }), { status: 400 });
    }

    // Server-side sanity checks mirroring the client validation — the
    // client can be bypassed, the server cannot.
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email))) {
      return new Response(JSON.stringify({ ok: false, error: 'Please enter a valid email address.' }), { status: 400 });
    }

    // ZIP arrives in its own field precisely so it can be checked here.
    // `location` cannot be validated as a ZIP: two forms legitimately put a
    // placement answer ("outdoor", "poolside") in it, so a blanket rule there
    // would reject valid submissions and cost leads.
    const zipCheck = checkOptionalZip(zip);
    if (!zipCheck.ok) {
      return new Response(JSON.stringify({ ok: false, error: zipCheck.message }), { status: 400 });
    }

    // SAFE MODE — never touches production services. The submission is
    // validated, logged (never a secret; there are none in this payload), and
    // acknowledged with devMode:true so the UI shows its "test mode" success
    // state instead of redirecting.
    //
    // Two ways in: a local `astro dev` server, or a hosted build with
    // BUXENA_SAFE_MODE=true — which is what makes a staging preview walkable
    // end to end without writing a real row or sending a real email. See
    // lib/safe-mode.ts. ENQUIRIES_DEV_LIVE=true opts a dev server back into
    // the live pipeline for a deliberate integration test.
    if (isLeadSafeMode()) {
      // The CAPPED values, not the raw body — safe mode has to show what
      // production would actually store, or it stops being a rehearsal.
      console.log(`[enquiries][safe-mode: ${safeModeReason()}] captured test submission:`, safe);
      // Preview the customer acknowledgment this submission would trigger in
      // production (nothing is sent in dev — this is the generated content).
      const ackPreview = buildCustomerAckEmail({
        name: safe.name,
        email: safe.email,
        location: safe.location,
        message: safe.message,
        saunaInterest: safe.saunaInterest,
        source: safe.source ?? undefined,
      });
      console.log(
        ackPreview
          ? `[enquiries][dev] customer ack would send — subject: "${ackPreview.subject}"\n${ackPreview.text}`
          : '[enquiries][dev] customer ack would NOT send (no email address, or enrichment submission).'
      );
      // A synthetic id so the browser exercises the same follow-up path it
      // uses in production; /api/project-files also short-circuits in dev.
      // An append echoes the id back, so the dev run models production: the
      // detail step and its files land on the enquiry step 1 created.
      return new Response(
        JSON.stringify({ ok: true, devMode: true, enquiryId: appendId ?? 'dev-mode-enquiry' }),
        { status: 200 }
      );
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
    let appendedId: string | null = null;
    let supabase: ReturnType<typeof createSupabaseAdminClient> | null = null;
    try {
      supabase = createSupabaseAdminClient();

      // MERGE, don't duplicate.
      //
      // The quote form captures the lead at step 1 and then offers an optional
      // step 2 for budget, capacity, installation, foundation, electrical, the
      // description of the space and the customer's photos and plans. Both
      // steps used to INSERT, so one buyer arrived in the CRM as two rows with
      // nothing joining them but a matching email address.
      //
      // That cost real money three ways. A salesperson opening the first row —
      // the one the staff notification points at — saw a bare pricing request
      // and none of the qualification the customer had just spent two minutes
      // providing. The customer's uploaded photos and plans attached to the
      // SECOND row, so the primary lead showed no files at all. And the
      // enquiry list showed two entries per buyer, which reads as two people.
      //
      // Merging keeps step 1's row as the single record for the whole journey.
      // Nothing about step 1's guarantees changes: the lead is already
      // captured and acknowledged before this runs.
      if (appendId) {
        const { data: existing, error: findError } = await supabase
          .from('enquiries')
          .select('id, message, phone, location, sauna_interest')
          .eq('id', appendId)
          .maybeSingle();

        if (findError) {
          console.error('[enquiries] append lookup failed, recording separately:', findError.message);
        } else if (existing) {
          const { error: updateError } = await supabase
            .from('enquiries')
            .update({
              // Capped again after joining: two capped halves still make one
              // oversized whole, and this column grows with every merge.
              message: [existing.message, safe.message].filter(Boolean).join('\n\n').slice(0, 16000),
              // Only ever fill a blank. The detail step re-sends the contact
              // fields, and step 1's values are the ones the customer typed
              // first — an overwrite could replace a good value with an empty
              // one if a field were cleared between steps.
              phone: existing.phone || safe.phone,
              location: existing.location || safe.location,
              sauna_interest: existing.sauna_interest || safe.saunaInterest,
            })
            .eq('id', appendId);

          if (updateError) {
            console.error('[enquiries] append failed, recording separately:', updateError.message);
          } else {
            recorded = true;
            appendedId = existing.id;
          }
        }
        // No row, or the update failed? Fall through to the insert below. A
        // second row is far better than silently discarding what the customer
        // wrote, so every failure here degrades to the old behaviour.
      }

      // Skipped when the merge above already placed this submission on an
      // existing enquiry.
      if (!recorded) {
        const row = {
          name: safe.name,
          email: safe.email,
          phone: safe.phone,
          location: safe.location,
          message: safe.message,
          chat_transcript: safeTranscript,
          sauna_interest: safe.saunaInterest,
          source: safe.source ?? 'Sauna Advisor',
          status: 'New',
        };

        let { data, error } = await supabase.from('enquiries').insert(row).select('id').single();

        // THE SOURCE CONSTRAINT FALLBACK.
        //
        // enquiries.source still admits only five values while the site sends
        // twelve; nine are refused outright (verified against the live
        // database, 2026-08-13). Refused meant the lead reached the inbox but
        // never became a record anybody could assign, chase or report on.
        //
        // Retry once with a source the column accepts, moving the true form
        // name into the message as a `Form:` line. Nothing invented, nothing
        // lost — the fact moves to a column the schema will hold, and
        // effectiveSource() reads it back so the admin still shows the real
        // form and still picks the right reply template.
        //
        // Narrow on purpose: only THIS constraint is retried, so an insert
        // failing for any other reason still falls through to the notification
        // path rather than being silently rewritten.
        //
        // supabase/migrations/2026-08-13-enquiry-source-constraint.sql removes
        // the need for this. Once applied the first insert succeeds and none
        // of the above runs.
        if (error && isSourceConstraintError(error)) {
          console.warn(
            `[enquiries] source "${row.source}" rejected by enquiries_source_check — ` +
              'recording as ' + FALLBACK_SOURCE + ' with the form named in the message. ' +
              'Apply supabase/migrations/2026-08-13-enquiry-source-constraint.sql to stop this.'
          );
          ({ data, error } = await supabase
            .from('enquiries')
            .insert({
              ...row,
              source: FALLBACK_SOURCE,
              message: withFormLine(row.message, row.source).slice(0, 8000),
            })
            .select('id')
            .single());
        }

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
    if ((inserted || appendedId) && supabase) {
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
      // A merge is a second event on an existing enquiry, not a new arrival —
      // the timeline should read "the customer came back and told us more",
      // which is a buying signal worth seeing. Attribution belongs only on the
      // arrival entry; on the merge it would just repeat step 1's.
      await supabase
        .from('activities')
        .insert({
          entity_type: 'enquiry',
          entity_id: appendedId ?? inserted!.id,
          activity_type: 'note',
          description: appendedId
            ? `Customer added project details — ${source || 'Quote Form — details'}`
            : `Enquiry received — ${source || 'Sauna Advisor'}${attributionDetails.length ? ` | ${attributionDetails.join(' · ')}` : ''}`,
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
    const notify = { ...safe, source: safe.source ?? undefined };
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

    // The id lets the browser attach project files to THIS enquiry in a
    // second request. Returning it is safe: it is a random uuid, it grants
    // no read access, and /api/project-files still verifies the enquiry
    // exists before accepting anything against it.
    //
    // On a merge this is the ORIGINAL enquiry's id, which is what puts the
    // customer's photos and plans on the record a salesperson actually opens.
    return new Response(JSON.stringify({ ok: true, enquiryId: appendedId ?? inserted?.id ?? null }), {
      status: decision.status,
    });
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
