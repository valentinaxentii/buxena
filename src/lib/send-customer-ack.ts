/**
 * Customer acknowledgment email — the automatic "we've received your
 * request" reply a visitor gets moments after submitting any lead form.
 *
 * Same infrastructure and safety model as send-enquiry-email.ts (Zoho SMTP
 * via the shared notify-smtp config; no new provider, no new env vars):
 * BEST-EFFORT ONLY. If SMTP is unconfigured, the address is missing, or the
 * send fails, it logs and returns — it never throws and never affects the
 * recorded enquiry or the response the visitor sees.
 *
 * WHO GETS IT: any submission that carries a valid email address, except
 * enrichment submissions (source "Quote Form — details") — those are the
 * second half of a progressive form the visitor already completed, and a
 * second email for the same project would read as a duplicate. That
 * exclusion is the server-side guarantee that one customer journey never
 * triggers two acknowledgments.
 *
 * COPY RULES (founder-approved constraints):
 *  - no response-time promise — "come back to you directly" mirrors the
 *    approved /thank-you page wording;
 *  - no pricing, no availability claims, no "included" promises;
 *  - transactional only — confirms their own request back to them.
 */

import { getNotifySmtpConfig, createNotifyTransport, escapeHtml as esc } from './notify-smtp';
import { identityFor, publicNameFor, presentationPath } from '../data/model-identity';

export interface CustomerAckInput {
  name?: string | null;
  email?: string | null;
  location?: string | null;
  message?: string | null;
  saunaInterest?: string | null;
  source?: string | null;
}

/**
 * Enrichment follow-ups that must never trigger a second acknowledgment.
 * Compared on letters only (case/dash/space/encoding-insensitive) — testing
 * proved the em dash in "Quote Form — details" does not survive every
 * transport encoding, and a missed match here would double-email a customer.
 */
const EXCLUDED_SOURCES = new Set(['quoteformdetails']);
const sourceKey = (source: string) => source.toLowerCase().replace(/[^a-z]/g, '');

const clean = (v: string | null | undefined, max = 200) => (v ?? '').trim().slice(0, max);

/**
 * Customer-facing model name. Uses the BUXENA identity map where the model
 * is mapped (e.g. "BUH-ELLA H2" → "ELLA"), falling back to the display title.
 * The supplier reference is never used in customer email.
 */
const displayModel = (title: string) => publicNameFor(title);

/**
 * Public path of a model's downloadable presentation, or null when the model
 * is unmapped. READY FOR, BUT NOT YET WIRED INTO, automatic sending: the
 * acknowledgment already receives the model on every submission, so linking
 * or attaching this file is a small, contained addition once approved.
 */
export function presentationFor(modelTitle?: string | null): string | null {
  const id = identityFor((modelTitle ?? '').trim());
  return id ? presentationPath(id.slug) : null;
}

export interface CustomerAckEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Pure builder — no transport, no env access — so the exact email any
 * submission would produce can be generated and inspected in dev/tests
 * without sending anything.
 */
export function buildCustomerAckEmail(input: CustomerAckInput): CustomerAckEmail | null {
  const email = clean(input.email);
  if (!email) return null;

  const source = clean(input.source) || 'Website';
  if (EXCLUDED_SOURCES.has(sourceKey(source))) return null;

  const firstName = clean(input.name).split(/\s+/)[0] || '';
  const model = clean(input.saunaInterest) ? displayModel(clean(input.saunaInterest)) : '';
  const location = clean(input.location);
  const message = clean(input.message, 1500);

  const greeting = firstName ? `Thank you, ${firstName}.` : 'Thank you.';
  // Founder-approved wording (2026-08-11): "We've received your request[ for
  // the MODEL]." — the model clause appears only when a model was supplied.
  const received = model
    ? `We’ve received your request for the ${model}.`
    : 'We’ve received your request.';
  const followUp = 'A BUXENA specialist will review your project details and follow up with you directly.';
  const closing =
    'If there’s anything else you’d like us to consider — measurements, photos, site details, or questions — simply reply to this email.';
  const lookForward = 'We look forward to helping you create the right sauna for your space.';

  const summaryRows: [string, string][] = [
    ...(model ? ([['Model', model]] as [string, string][]) : []),
    ...(location ? ([['Location / ZIP', location]] as [string, string][]) : []),
  ];

  const subject = 'We received your BUXENA request';

  const text = [
    'BUXENA',
    '',
    greeting,
    '',
    received,
    '',
    followUp,
    '',
    ...(summaryRows.length
      ? ['Your request:', ...summaryRows.map(([k, v]) => `  ${k}: ${v}`), '']
      : []),
    ...(message ? ['Your notes:', message, ''] : []),
    closing,
    '',
    lookForward,
    '',
    'BUXENA',
    'Where Wellness Starts',
    'buxena.com · info@buxena.com',
  ].join('\n');

  // Table-based layout with fully inline styles — the only structure that
  // renders consistently across Gmail/Outlook/Apple Mail. No remote images
  // (blocked by default in most clients): the wordmark is set in text.
  const html = `
<div style="margin:0;padding:24px 12px;background:#f7f3ec;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:560px;background:#ffffff;">
        <tr>
          <td style="padding:28px 32px 22px;border-bottom:1px solid #e7ded1;">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:0.32em;color:#2b211a;">BUXENA</span>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.35;color:#2b211a;">
            ${esc(greeting)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#453a30;">
            ${esc(received)}<br><br>
            ${esc(followUp)}
          </td>
        </tr>
        ${
          summaryRows.length
            ? `<tr><td style="padding:22px 32px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border-top:2px solid #2b211a;">
            ${summaryRows
              .map(
                ([k, v]) => `<tr>
              <td style="padding:10px 16px 10px 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#8a7c6a;border-bottom:1px solid #e7ded1;white-space:nowrap;">${esc(k)}</td>
              <td style="padding:10px 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#2b211a;border-bottom:1px solid #e7ded1;" align="right">${esc(v)}</td>
            </tr>`
              )
              .join('')}
          </table>
        </td></tr>`
            : ''
        }
        ${
          message
            ? `<tr><td style="padding:22px 32px 0;">
          <p style="margin:0 0 6px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#8a7c6a;">Your notes</p>
          <div style="white-space:pre-wrap;padding:14px 16px;background:#f7f3ec;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#453a30;">${esc(message)}</div>
        </td></tr>`
            : ''
        }
        <tr>
          <td style="padding:24px 32px 8px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#453a30;">
            ${esc(closing)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 30px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#453a30;">
            ${esc(lookForward)}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px 26px;border-top:1px solid #e7ded1;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#8a7c6a;">
            <span style="letter-spacing:0.22em;color:#2b211a;">BUXENA</span><br>
            Where Wellness Starts<br>
            <a href="https://buxena.com" style="color:#8f6e42;text-decoration:none;">buxena.com</a> ·
            <a href="mailto:info@buxena.com" style="color:#8f6e42;text-decoration:none;">info@buxena.com</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</div>`.trim();

  return { to: email, subject, text, html };
}

export async function sendCustomerAckEmail(input: CustomerAckInput): Promise<void> {
  const mail = buildCustomerAckEmail(input);
  if (!mail) return; // no email address, or an excluded enrichment submission

  const config = getNotifySmtpConfig();
  if (!config) {
    if (import.meta.env.DEV) {
      console.info('[customer-ack] SMTP not configured — skipping acknowledgment email.');
    }
    return;
  }

  const transporter = createNotifyTransport(config);
  try {
    await transporter.sendMail({
      // From must be the authenticated Zoho mailbox (see send-enquiry-email.ts).
      // Replies naturally land in that same mailbox — the stated reply path.
      from: `BUXENA <${config.user}>`,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (err) {
    // Log-only: a failed acknowledgment must never surface to the visitor or
    // shadow the fact that the enquiry itself is already safely recorded.
    console.error('[customer-ack] Zoho SMTP send failed:', err);
  } finally {
    transporter.close();
  }
}
