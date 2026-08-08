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
 * Configuration (server-side env vars — set in Netlify: Site configuration →
 * Environment variables, and in .env for local testing):
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

import nodemailer from 'nodemailer';

export interface EnquiryEmailInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  message?: string | null;
  saunaInterest?: string | null;
  source?: string | null;
}

const DEFAULT_TO = 'info@buxena.com';
const DEFAULT_HOST = 'smtp.zoho.com';
const DEFAULT_PORT = 465;

/**
 * Config is read from the runtime environment first, falling back to the value
 * inlined at build time. Netlify exposes its environment variables to the
 * running Function via process.env, which means changing the SMTP password in
 * the Netlify UI takes effect without a rebuild. `import.meta.env` is the
 * fallback that makes `astro dev` (which loads .env into import.meta.env only)
 * work locally. Both accessors must be written out statically — Vite can only
 * inline `import.meta.env.SOME_NAME`, never a dynamic lookup.
 */
function pick(runtime: string | undefined, buildTime: unknown): string {
  const value = runtime ?? (typeof buildTime === 'string' ? buildTime : undefined);
  return (value ?? '').trim();
}

const procEnv: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

/** Minimal HTML escaping so visitor-supplied text can't break the markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendEnquiryEmail(input: EnquiryEmailInput): Promise<void> {
  const user = pick(procEnv.ZOHO_SMTP_USER, import.meta.env.ZOHO_SMTP_USER);
  const pass = pick(procEnv.ZOHO_SMTP_PASSWORD, import.meta.env.ZOHO_SMTP_PASSWORD);
  const to = pick(procEnv.ENQUIRY_NOTIFY_TO, import.meta.env.ENQUIRY_NOTIFY_TO) || DEFAULT_TO;
  const host = pick(procEnv.ZOHO_SMTP_HOST, import.meta.env.ZOHO_SMTP_HOST) || DEFAULT_HOST;
  const port =
    Number(pick(procEnv.ZOHO_SMTP_PORT, import.meta.env.ZOHO_SMTP_PORT)) || DEFAULT_PORT;

  // Unconfigured — quietly skip. Submissions still record to Supabase.
  if (!user || !pass) {
    if (import.meta.env.DEV) {
      console.info('[enquiry-email] ZOHO_SMTP_USER/ZOHO_SMTP_PASSWORD not set — skipping email.');
    }
    return;
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
    'This enquiry is also saved in BUXENA Admin → Website Enquiries.',
  ].join('\n');

  const htmlBody = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.6;">
      <h2 style="margin: 0 0 4px; font-size: 18px;">New enquiry — ${esc(source)}</h2>
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
        Also saved in BUXENA Admin → Website Enquiries.
      </p>
    </div>
  `.trim();

  // Zoho rejects a From address that isn't the authenticated mailbox (or one of
  // its verified aliases), so From is derived from ZOHO_SMTP_USER rather than
  // being separately configurable — one less setting that can silently break
  // delivery. Only the display name is fixed text.
  const from = `BUXENA Website <${user}>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    // Port 465 is implicit SSL/TLS from the first byte. Any other port (587)
    // starts plaintext and upgrades via STARTTLS, which nodemailer handles when
    // `secure` is false.
    secure: port === 465,
    auth: { user, pass },
    // A visitor is waiting on this request — never let a stalled SMTP
    // connection hold the form open indefinitely.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `New enquiry — ${name}`,
      text: textBody,
      html: htmlBody,
      // Let staff reply straight to the customer from their inbox.
      ...(input.email?.trim() ? { replyTo: input.email.trim() } : {}),
    });
  } catch (err) {
    // Surface the failure in the Netlify function logs only — never to the
    // visitor, and never as a thrown error that could mask a saved enquiry.
    console.error('[enquiry-email] Zoho SMTP send failed:', err);
  } finally {
    transporter.close();
  }
}
