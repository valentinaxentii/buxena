/**
 * Best-effort email notification for a new website enquiry.
 *
 * Sends over Zoho Mail's SMTP server using nodemailer. This runs inside the
 * Netlify Function that serves /api/enquiries (a Node runtime — plain TCP/SSL
 * to port 465 is allowed there). No third-party email API, no extra DNS
 * records beyond the ones Zoho already needs to run buxena.com's mailboxes.
 *
 * Like the rest of that route it is BEST-EFFORT: if SMTP is unconfigured or the
 * send fails, it logs and returns normally. It never throws and never changes
 * the response the visitor gets — the enquiry is already safely stored in
 * Supabase and visible in BUXENA Admin regardless of email delivery.
 *
 * Configuration lives in notify-smtp.ts (shared with the new-lead email):
 *   ZOHO_SMTP_USER     — the Zoho mailbox that sends, e.g. info@buxena.com.
 *   ZOHO_SMTP_PASSWORD — Zoho App Password (NOT the normal login password).
 *                        Generate at Zoho → My Account → Security → App Passwords.
 *   ENQUIRY_NOTIFY_TO  — recipient. Optional, defaults to info@buxena.com.
 *   ZOHO_SMTP_HOST     — optional. Defaults to smtp.zoho.com. Accounts hosted in
 *                        Zoho's EU data centre must use smtp.zoho.eu instead.
 *   ZOHO_SMTP_PORT     — optional. Defaults to 465 (implicit SSL).
 *
 * If ZOHO_SMTP_USER or ZOHO_SMTP_PASSWORD is missing, email quietly no-ops so
 * local dev and any unconfigured environment keep working exactly as before.
 */

import { getNotifySmtpConfig, createNotifyTransport, escapeHtml as esc } from './notify-smtp';

export interface EnquiryEmailInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  message?: string | null;
  saunaInterest?: string | null;
  source?: string | null;
  /**
   * True when the database write failed and this email is the ONLY surviving
   * copy of the enquiry. Changes the closing line from "it's also in Admin" —
   * which would be false — into an instruction to add it by hand.
   */
  unrecorded?: boolean;
}

/**
 * Returns TRUE only when the message was actually handed to Zoho. Not
 * configured, or the send failed, returns FALSE — it still never throws.
 *
 * The boolean matters: /api/enquiries treats a delivered staff notification
 * as a second capture path when the database write fails, and "resolved
 * without throwing" is not the same as "a human received this". Returning
 * void made those two indistinguishable.
 */
export async function sendEnquiryEmail(input: EnquiryEmailInput): Promise<boolean> {
  const config = getNotifySmtpConfig();

  // Unconfigured — quietly skip. Submissions still record to Supabase.
  if (!config) {
    if (import.meta.env.DEV) {
      console.info('[enquiry-email] ZOHO_SMTP_USER/ZOHO_SMTP_PASSWORD not set — skipping email.');
    }
    return false;
  }

  const source = input.source?.trim() || 'Website';
  const name = input.name?.trim() || 'No name given';
  const message = input.message?.trim() || '';

  // Every requested field gets its own row, and stays visible even when the
  // visitor left it blank — a missing row reads as "the form is broken", an
  // em dash reads as "they didn't fill this in".
  const rows: [string, string][] = [
    ['Name', input.name?.trim() || '—'],
    ['Email', input.email?.trim() || '—'],
    ['Phone', input.phone?.trim() || '—'],
    ['ZIP / Location', input.location?.trim() || '—'],
    ['Model / request', input.saunaInterest?.trim() || '—'],
    ['Source', source],
  ];

  const textBody = [
    `New enquiry from the BUXENA website (${source}).`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    message ? `Message:\n${message}` : 'Message: —',
    '',
    input.unrecorded
      ? 'ACTION NEEDED — this enquiry could NOT be saved to the database. This email is the only copy. Add it manually in BUXENA Admin → Website Enquiries, and reply to the customer.'
      : 'This enquiry is also saved in BUXENA Admin → Website Enquiries.',
  ].join('\n');

  const htmlBody = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.6;">
      <h2 style="margin: 0 0 4px; font-size: 18px;">New enquiry — ${esc(source)}</h2>
      ${
        input.unrecorded
          ? `<p style="margin: 8px 0 12px; padding: 10px 12px; background: #fdf0ea; border: 1px solid #e2a184; border-radius: 6px; color: #8c3d1c; font-size: 13px;">
              <strong>Action needed — not saved to the database.</strong><br />
              This email is the only copy of this enquiry. Add it manually in
              BUXENA Admin → Website Enquiries, and reply to the customer.
            </p>`
          : ''
      }
      <table style="border-collapse: collapse; margin: 12px 0;">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding: 4px 16px 4px 0; color: #6b6b6b; vertical-align: top; white-space: nowrap;">${esc(
                k
              )}</td><td style="padding: 4px 0;">${esc(v)}</td></tr>`
          )
          .join('')}
      </table>
      ${
        message
          ? `<p style="margin: 4px 0 6px; color: #6b6b6b;">Message</p><div style="white-space: pre-wrap; padding: 12px 14px; background: #f5f2ec; border-radius: 6px;">${esc(
              message
            )}</div>`
          : '<p style="color: #6b6b6b;">No message provided.</p>'
      }
      <p style="margin: 16px 0 0; font-size: 12px; color: #8a8a8a;">
        ${
          input.unrecorded
            ? 'NOT saved to the database — add this enquiry manually.'
            : 'Also saved in BUXENA Admin → Website Enquiries.'
        }
      </p>
    </div>
  `.trim();

  const transporter = createNotifyTransport(config);

  try {
    await transporter.sendMail({
      // Zoho rejects a From address that isn't the authenticated mailbox (or one
      // of its verified aliases), so From is derived from ZOHO_SMTP_USER rather
      // than being separately configurable — one less setting that can silently
      // break delivery. Only the display name is fixed text.
      from: `BUXENA Website <${config.user}>`,
      to: config.to,
      subject: `New enquiry — ${name}`,
      text: textBody,
      html: htmlBody,
      // Let staff reply straight to the customer from their inbox.
      ...(input.email?.trim() ? { replyTo: input.email.trim() } : {}),
    });
    return true;
  } catch (err) {
    // Surface the failure in the Netlify function logs only — never to the
    // visitor, and never as a thrown error that could mask a saved enquiry.
    console.error('[enquiry-email] Zoho SMTP send failed:', err);
    return false;
  } finally {
    transporter.close();
  }
}
