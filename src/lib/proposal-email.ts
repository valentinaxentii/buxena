import { createNotifyTransport, escapeHtml as esc, getNotifySmtpConfig } from './notify-smtp.ts';

const clean = (value: string | null | undefined, max = 300) => (value ?? '').trim().slice(0, max);
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const money = (value: number) => value.toLocaleString('en-US', {
  style: 'currency', currency: 'USD',
  minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2,
});

const date = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
};

export interface ProposalEmailInput {
  customerName?: string | null;
  customerEmail?: string | null;
  proposalUrl: string;
  quoteNumber: string;
  modelName?: string | null;
  expiryDate?: string | null;
  advisorName?: string | null;
  total: number;
}

export interface ProposalAcceptanceEmailInput extends ProposalEmailInput {
  acceptedName: string;
  adminUrl?: string | null;
}

export interface BuiltEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export type ProposalEmailDelivery =
  | { sent: true }
  | { sent: false; reason: 'invalid-recipient' | 'unconfigured' | 'failed' };

function emailFrame(title: string, body: string, button?: { label: string; href: string }) {
  return `
<div style="margin:0;padding:24px 12px;background:#f7f3ec;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px;background:#ffffff;border:1px solid #e2d8ca;">
        <tr><td style="padding:24px 30px;border-bottom:1px solid #e2d8ca;font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:0.3em;color:#241f1a;">BUXENA</td></tr>
        <tr><td style="padding:30px 30px 8px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#241f1a;">${esc(title)}</td></tr>
        <tr><td style="padding:8px 30px 4px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#4d453d;">${body}</td></tr>
        ${button ? `<tr><td style="padding:22px 30px 8px;"><a href="${esc(button.href)}" style="display:inline-block;padding:13px 22px;background:#9b7748;color:#ffffff;text-decoration:none;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.06em;">${esc(button.label)}</a></td></tr>` : ''}
        <tr><td style="padding:24px 30px 28px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:#74695e;">Questions? Reply to this email or contact <a href="mailto:info@buxena.com" style="color:#8f6e42;">info@buxena.com</a>.</td></tr>
        <tr><td style="padding:18px 30px;border-top:1px solid #e2d8ca;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#8a7c6a;">BUXENA · Where Wellness Starts · Connecticut, USA</td></tr>
      </table>
    </td></tr>
  </table>
</div>`.trim();
}

export function buildProposalEmail(input: ProposalEmailInput): BuiltEmail | null {
  const to = clean(input.customerEmail);
  if (!validEmail(to)) return null;
  const customer = clean(input.customerName) || 'there';
  const model = clean(input.modelName) || 'sauna';
  const advisor = clean(input.advisorName) || 'your BUXENA advisor';
  const expiry = date(input.expiryDate);
  const total = money(Number(input.total) || 0);
  const summary = [
    `Proposal: ${clean(input.quoteNumber)}`, `Model: ${model}`,
    `Delivered investment: ${total}`, ...(expiry ? [`Valid until: ${expiry}`] : []),
    `Advisor: ${advisor}`,
  ];
  const text = [
    'BUXENA', '', `Hello ${customer},`, '', `Your complete proposal for the ${model} is ready.`, '',
    ...summary, '', 'Review your proposal:', input.proposalUrl, '',
    'The proposal includes the configured package, pricing, delivery, site requirements, warranty information and next steps.',
    'Accepting records your intention to proceed. It does not charge you or place the final order.', '',
    'Reply to this email with any questions.', '', 'BUXENA', 'Where Wellness Starts',
  ].join('\n');
  const rows = summary.map((row) => {
    const [label, ...rest] = row.split(': ');
    return `<tr><td style="padding:9px 12px 9px 0;color:#776b5f;border-bottom:1px solid #e8e0d6;">${esc(label)}</td><td align="right" style="padding:9px 0;border-bottom:1px solid #e8e0d6;color:#241f1a;font-weight:600;">${esc(rest.join(': '))}</td></tr>`;
  }).join('');
  const body = `<p style="margin:0 0 16px;">Hello ${esc(customer)},</p>
    <p style="margin:0 0 18px;">Your complete proposal is ready. It brings the configured sauna, delivered price, availability, site requirements and next steps into one clear document.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0;">${rows}</table>
    <p style="margin:16px 0 0;font-size:13px;color:#74695e;">Accepting records your intention to proceed. It does not charge you or place the final order.</p>`;
  return {
    to, subject: `${model} proposal from BUXENA — ${clean(input.quoteNumber)}`, text,
    html: emailFrame(`Your ${model} proposal is ready`, body, { label: 'Review your proposal', href: input.proposalUrl }),
  };
}

export function buildProposalAcceptedCustomerEmail(input: ProposalAcceptanceEmailInput): BuiltEmail | null {
  const to = clean(input.customerEmail);
  if (!validEmail(to)) return null;
  const firstName = clean(input.customerName).split(/\s+/)[0] || clean(input.acceptedName).split(/\s+/)[0] || 'there';
  const model = clean(input.modelName) || 'sauna';
  const total = money(Number(input.total) || 0);
  const text = [
    'BUXENA', '', `Thank you, ${firstName}.`, '',
    `We recorded your acceptance of proposal ${clean(input.quoteNumber)} for the ${model}.`,
    `Proposal total: ${total}`, '', 'Nothing has been charged and the final order has not yet been placed.',
    'Your BUXENA advisor will confirm the specification, availability, delivery access and payment instructions with you directly.', '',
    'View the accepted proposal:', input.proposalUrl, '', 'BUXENA', 'Where Wellness Starts',
  ].join('\n');
  const body = `<p style="margin:0 0 16px;">Thank you, ${esc(firstName)}.</p>
    <p style="margin:0 0 16px;">We recorded your acceptance of proposal <strong>${esc(clean(input.quoteNumber))}</strong> for the ${esc(model)}.</p>
    <p style="margin:0 0 16px;"><strong>Proposal total: ${esc(total)}</strong></p>
    <p style="margin:0;color:#5f554c;">Nothing has been charged and the final order has not yet been placed. Your BUXENA advisor will confirm the final specification, availability, delivery access and payment instructions with you directly.</p>`;
  return {
    to, subject: `We recorded your BUXENA proposal acceptance — ${clean(input.quoteNumber)}`, text,
    html: emailFrame('Your acceptance is recorded', body, { label: 'View accepted proposal', href: input.proposalUrl }),
  };
}

export function buildProposalAcceptedStaffEmail(input: ProposalAcceptanceEmailInput, staffEmail: string): BuiltEmail | null {
  const to = clean(staffEmail);
  if (!validEmail(to)) return null;
  const customer = clean(input.customerName) || 'Customer';
  const model = clean(input.modelName) || 'Sauna';
  const total = money(Number(input.total) || 0);
  const adminUrl = clean(input.adminUrl) || input.proposalUrl;
  const text = [
    `Proposal accepted: ${clean(input.quoteNumber)}`, '', `Customer: ${customer}`,
    `Accepted by: ${clean(input.acceptedName)}`, `Customer email: ${clean(input.customerEmail) || '—'}`,
    `Model: ${model}`, `Proposal total: ${total}`, '', 'Open the quote in BUXENA Admin:', adminUrl,
  ].join('\n');
  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td style="padding:8px 12px 8px 0;color:#776b5f;border-bottom:1px solid #e8e0d6;">Customer</td><td align="right" style="border-bottom:1px solid #e8e0d6;font-weight:600;">${esc(customer)}</td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#776b5f;border-bottom:1px solid #e8e0d6;">Accepted by</td><td align="right" style="border-bottom:1px solid #e8e0d6;font-weight:600;">${esc(clean(input.acceptedName))}</td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#776b5f;border-bottom:1px solid #e8e0d6;">Model</td><td align="right" style="border-bottom:1px solid #e8e0d6;font-weight:600;">${esc(model)}</td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#776b5f;border-bottom:1px solid #e8e0d6;">Total</td><td align="right" style="border-bottom:1px solid #e8e0d6;font-weight:600;">${esc(total)}</td></tr>
    </table><p style="margin:18px 0 0;">Confirm the final specification, availability, delivery access and payment instructions before converting the quote to an order.</p>`;
  return {
    to, subject: `Proposal accepted — ${clean(input.quoteNumber)} — ${customer}`, text,
    html: emailFrame('A customer accepted a proposal', body, { label: 'Open quote in BUXENA Admin', href: adminUrl }),
    ...(validEmail(clean(input.customerEmail)) ? { replyTo: clean(input.customerEmail) } : {}),
  };
}

export async function sendProposalEmail(input: ProposalEmailInput): Promise<ProposalEmailDelivery> {
  const mail = buildProposalEmail(input);
  if (!mail) return { sent: false, reason: 'invalid-recipient' };
  const config = getNotifySmtpConfig();
  if (!config) return { sent: false, reason: 'unconfigured' };
  const transporter = createNotifyTransport(config);
  try {
    await transporter.sendMail({ from: `BUXENA <${config.user}>`, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    return { sent: true };
  } catch (error) {
    console.error('[proposal-email] Zoho SMTP send failed:', error);
    return { sent: false, reason: 'failed' };
  } finally { transporter.close(); }
}

export async function sendProposalAcceptanceEmails(input: ProposalAcceptanceEmailInput) {
  const config = getNotifySmtpConfig();
  if (!config) return { customerSent: false, staffSent: false, reason: 'unconfigured' as const };
  const customerMail = buildProposalAcceptedCustomerEmail(input);
  const staffMail = buildProposalAcceptedStaffEmail(input, config.proposalTo);
  const transporter = createNotifyTransport(config);
  let customerSent = false;
  let staffSent = false;
  try {
    if (customerMail) try {
      await transporter.sendMail({ from: `BUXENA <${config.user}>`, to: customerMail.to, subject: customerMail.subject, text: customerMail.text, html: customerMail.html });
      customerSent = true;
    } catch (error) { console.error('[proposal-acceptance-email] customer confirmation failed:', error); }
    if (staffMail) try {
      await transporter.sendMail({ from: `BUXENA Proposal <${config.user}>`, to: staffMail.to, subject: staffMail.subject, text: staffMail.text, html: staffMail.html, replyTo: staffMail.replyTo });
      staffSent = true;
    } catch (error) { console.error('[proposal-acceptance-email] staff notification failed:', error); }
    return { customerSent, staffSent, reason: customerSent || staffSent ? 'sent' as const : 'failed' as const };
  } finally { transporter.close(); }
}
