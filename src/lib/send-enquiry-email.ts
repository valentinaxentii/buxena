/**
 * Best-effort email notification for a new enquiry.
 *
 * Sends a plain HTTP request to Resend (https://resend.com) — no SDK, no extra
 * dependency, works inside a Netlify Function. Called from /api/enquiries after
 * the row is recorded. Like the rest of that route it is BEST-EFFORT: if the
 * email provider is unconfigured or the request fails, it never throws and never
 * changes the response the visitor gets. The submission is already safely stored
 * in Supabase (and, separately, in Netlify Forms) regardless of email delivery.
 *
 * Configuration (server-side env vars — set in Netlify: Site configuration →
 * Environment variables, and in .env for local testing):
 *   RESEND_API_KEY      — secret API key from resend.com. If unset, this no-ops.
 *   ENQUIRY_NOTIFY_TO   — recipient. Defaults to info@buxena.com.
 *   ENQUIRY_NOTIFY_FROM — verified sender, e.g. "BUXENA <notifications@buxena.com>".
 *                         Must be on a domain verified in Resend. If unset, no-ops.
 */

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

/** Minimal HTML escaping so visitor-supplied text can't break the markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendEnquiryEmail(input: EnquiryEmailInput): Promise<void> {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const from = import.meta.env.ENQUIRY_NOTIFY_FROM;
  const to = import.meta.env.ENQUIRY_NOTIFY_TO || DEFAULT_TO;

  // Unconfigured — quietly skip. This keeps local dev and any environment
  // without an email provider working exactly as before.
  if (!apiKey || !from) {
    if (import.meta.env.DEV) {
      console.info('[enquiry-email] RESEND_API_KEY/ENQUIRY_NOTIFY_FROM not set — skipping email.');
    }
    return;
  }

  const source = input.source || 'Website';
  const name = input.name?.trim() || 'No name given';

  // Human-readable label rows — only include fields that have a value.
  const rows: [string, string][] = [
    ['Name', input.name?.trim() || ''],
    ['Email', input.email?.trim() || ''],
    ['Phone', input.phone?.trim() || ''],
    ['Location / ZIP', input.location?.trim() || ''],
    ['Model interest', input.saunaInterest?.trim() || ''],
    ['Source', source],
  ].filter(([, v]) => v) as [string, string][];

  const message = input.message?.trim() || '';

  const textBody = [
    `New enquiry from the BUXENA website (${source}).`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    message ? `Message:\n${message}` : 'No message provided.',
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
    </div>
  `.trim();

  const payload: Record<string, unknown> = {
    from,
    to: [to],
    subject: `New quote request — ${name}`,
    text: textBody,
    html: htmlBody,
  };

  // Let staff reply straight to the customer from their inbox.
  const replyTo = input.email?.trim();
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Surface the failure in server logs only — never to the visitor.
    const detail = await res.text().catch(() => '');
    console.error(`[enquiry-email] Resend responded ${res.status}: ${detail}`);
  }
}
