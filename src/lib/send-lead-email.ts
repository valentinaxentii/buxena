/**
 * Best-effort email notification for a newly created lead.
 *
 * Fires when staff create a lead manually in the admin (/admin/leads/new).
 * Enquiry-to-lead conversion deliberately does NOT send this — the enquiry
 * already emailed info@ when it arrived from the website, and a second email
 * for the same person converting would be duplicate noise.
 *
 * Same contract as sendEnquiryEmail: never throws, never changes the response
 * the staff member gets — the lead is already saved before this is called.
 * SMTP unconfigured means it quietly no-ops (see notify-smtp.ts).
 */

import { getNotifySmtpConfig, createNotifyTransport, escapeHtml as esc } from './notify-smtp';

export interface LeadEmailInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  source?: string | null;
  modelName?: string | null;
  budget?: number | null;
  timeline?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

export async function sendLeadEmail(input: LeadEmailInput): Promise<void> {
  const config = getNotifySmtpConfig();
  if (!config) {
    if (import.meta.env.DEV) {
      console.info('[lead-email] ZOHO_SMTP_USER/ZOHO_SMTP_PASSWORD not set — skipping email.');
    }
    return;
  }

  const source = input.source?.trim() || 'Manual';
  const budget =
    input.budget != null && Number.isFinite(input.budget)
      ? `$${input.budget.toLocaleString('en-US')}`
      : '—';

  const rows: [string, string][] = [
    ['Name', input.name],
    ['Email', input.email?.trim() || '—'],
    ['Phone', input.phone?.trim() || '—'],
    ['State', input.state?.trim() || '—'],
    ['Source', source],
    ['Model of interest', input.modelName?.trim() || '—'],
    ['Budget', budget],
    ['Timeline', input.timeline?.trim() || '—'],
    ['Created by', input.createdBy?.trim() || '—'],
  ];

  const notes = input.notes?.trim() || '';

  const textBody = [
    `New lead added in BUXENA Admin (${source}).`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    notes ? `Notes:\n${notes}` : 'Notes: —',
    '',
    'View and manage this lead in BUXENA Admin → Leads.',
  ].join('\n');

  const htmlBody = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.6;">
      <h2 style="margin: 0 0 4px; font-size: 18px;">New lead — ${esc(input.name)}</h2>
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
        notes
          ? `<p style="margin: 4px 0 6px; color: #6b6b6b;">Notes</p><div style="white-space: pre-wrap; padding: 12px 14px; background: #f5f2ec; border-radius: 6px;">${esc(
              notes
            )}</div>`
          : '<p style="color: #6b6b6b;">No notes.</p>'
      }
      <p style="margin: 16px 0 0; font-size: 12px; color: #8a8a8a;">
        View and manage this lead in BUXENA Admin &rarr; Leads.
      </p>
    </div>
  `.trim();

  const transporter = createNotifyTransport(config);
  try {
    await transporter.sendMail({
      // Zoho rejects a From that isn't the authenticated mailbox, so From is
      // derived from the SMTP user — only the display name is fixed text.
      from: `BUXENA Admin <${config.user}>`,
      to: config.to,
      subject: `New lead — ${input.name}`,
      text: textBody,
      html: htmlBody,
      ...(input.email?.trim() ? { replyTo: input.email.trim() } : {}),
    });
  } catch (err) {
    console.error('[lead-email] Zoho SMTP send failed:', err);
  } finally {
    transporter.close();
  }
}
