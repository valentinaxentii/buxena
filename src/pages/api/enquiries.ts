import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import { sendEnquiryEmail } from '../../lib/send-enquiry-email';
import { sendCustomerAckEmail, buildCustomerAckEmail } from '../../lib/send-customer-ack';
import { sendEnquiryTelegram } from '../../lib/notify-telegram';
import { checkRateLimit } from '../../lib/rate-limit';

export const prerender = false;
const INTERNAL_ERROR = 'We could not submit your request right now. Please try again shortly.';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const devTestMode = import.meta.env.DEV && process.env.ENQUIRIES_DEV_LIVE !== 'true';
  if (!devTestMode) {
    const { allowed, retryAfterSeconds } = checkRateLimit(`enquiries:${clientAddress}`, 5, 10 * 60_000);
    if (!allowed) return new Response(JSON.stringify({ ok: false, error: 'Too many requests. Please try again shortly.' }), { status: 429, headers: { 'Retry-After': String(retryAfterSeconds), 'Content-Type': 'application/json' } });
  }

  try {
    const body = await request.json();
    const { name, email, phone, location, message, chatTranscript, saunaInterest, source, attribution, botField } = body ?? {};
    if (botField) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (!message && !(chatTranscript && chatTranscript.length)) return new Response(JSON.stringify({ ok: false, error: 'Nothing to record.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email))) return new Response(JSON.stringify({ ok: false, error: 'Please enter a valid email address.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    if (import.meta.env.DEV && process.env.ENQUIRIES_DEV_LIVE !== 'true') {
      console.log('[enquiries][dev] captured local test submission:', { name, email, phone, location, saunaInterest, source, message });
      const ackPreview = buildCustomerAckEmail({ name, email, location, message, saunaInterest, source });
      console.log(ackPreview ? `[enquiries][dev] customer ack would send — subject: "${ackPreview.subject}"\n${ackPreview.text}` : '[enquiries][dev] customer ack would NOT send (no email address, or enrichment submission).');
      return new Response(JSON.stringify({ ok: true, devMode: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createSupabaseAdminClient();
    const { data: inserted, error } = await supabase.from('enquiries').insert({
      name: name || null, email: email || null, phone: phone || null, location: location || null,
      message: message || null, chat_transcript: chatTranscript || null, sauna_interest: saunaInterest || null,
      source: source || 'Sauna Advisor', status: 'New',
    }).select('id').single();

    if (error) {
      console.error('[enquiries] database insert failed:', error);
      return new Response(JSON.stringify({ ok: false, error: INTERNAL_ERROR }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    if (inserted) {
      const cleanAttribution = (key: string) => {
        const value = attribution && typeof attribution === 'object' ? (attribution as Record<string, unknown>)[key] : null;
        return typeof value === 'string' ? value.trim().slice(0, 300) : '';
      };
      const attributionDetails = [
        ['landing page', cleanAttribution('landingPath')], ['referrer', cleanAttribution('referrerHost')],
        ['utm source', cleanAttribution('utmSource')], ['utm medium', cleanAttribution('utmMedium')],
        ['utm campaign', cleanAttribution('utmCampaign')], ['utm content', cleanAttribution('utmContent')],
        ['utm term', cleanAttribution('utmTerm')],
      ].filter(([, value]) => Boolean(value)).map(([label, value]) => `${label}: ${value}`);
      await supabase.from('activities').insert({ entity_type: 'enquiry', entity_id: inserted.id, activity_type: 'note', description: `Enquiry received — ${source || 'Sauna Advisor'}${attributionDetails.length ? ` | ${attributionDetails.join(' · ')}` : ''}` }).then(() => {}, (err) => console.error('[enquiries] activity log failed:', err));
    }

    const notify = { name, email, phone, location, message, saunaInterest, source };
    const [emailResult, telegramResult, ackResult] = await Promise.allSettled([sendEnquiryEmail(notify), sendEnquiryTelegram(notify), sendCustomerAckEmail(notify)]);
    if (emailResult.status === 'rejected') console.error('[enquiries] email notify failed:', emailResult.reason);
    if (telegramResult.status === 'rejected') console.error('[enquiries] telegram notify failed:', telegramResult.reason);
    if (ackResult.status === 'rejected') console.error('[enquiries] customer ack failed:', ackResult.reason);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[enquiries] unhandled submission error:', e);
    return new Response(JSON.stringify({ ok: false, error: INTERNAL_ERROR }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
