/**
 * Shared Zoho SMTP transport for admin notification emails (enquiries, leads).
 *
 * Same env vars as documented in send-enquiry-email.ts / .env.example:
 *   ZOHO_SMTP_USER, ZOHO_SMTP_PASSWORD (required — missing means "skip email"),
 *   ENQUIRY_NOTIFY_TO and PROPOSAL_NOTIFY_TO (optional recipient overrides),
 *   ZOHO_SMTP_HOST, ZOHO_SMTP_PORT.
 *
 * Runtime process.env wins over the build-time inlined value so a password
 * rotated in the Netlify UI takes effect without a rebuild; import.meta.env is
 * the fallback that makes `astro dev` work locally. Both accessors must be
 * written out statically — Vite can only inline `import.meta.env.SOME_NAME`.
 */

import nodemailer from 'nodemailer';

const DEFAULT_TO = 'info@buxena.com';
const DEFAULT_HOST = 'smtp.zoho.com';
const DEFAULT_PORT = 465;

function pick(runtime: string | undefined, buildTime: unknown): string {
  const value = runtime ?? (typeof buildTime === 'string' ? buildTime : undefined);
  return (value ?? '').trim();
}

const procEnv: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

export interface NotifySmtpConfig {
  user: string;
  pass: string;
  to: string;
  proposalTo: string;
  host: string;
  port: number;
}

/** Null when SMTP is unconfigured — callers should quietly skip sending. */
export function getNotifySmtpConfig(): NotifySmtpConfig | null {
  const user = pick(procEnv.ZOHO_SMTP_USER, import.meta.env.ZOHO_SMTP_USER);
  const pass = pick(procEnv.ZOHO_SMTP_PASSWORD, import.meta.env.ZOHO_SMTP_PASSWORD);
  if (!user || !pass) return null;
  const to = pick(procEnv.ENQUIRY_NOTIFY_TO, import.meta.env.ENQUIRY_NOTIFY_TO) || DEFAULT_TO;
  return {
    user,
    pass,
    to,
    proposalTo: pick(procEnv.PROPOSAL_NOTIFY_TO, import.meta.env.PROPOSAL_NOTIFY_TO) || to,
    host: pick(procEnv.ZOHO_SMTP_HOST, import.meta.env.ZOHO_SMTP_HOST) || DEFAULT_HOST,
    port: Number(pick(procEnv.ZOHO_SMTP_PORT, import.meta.env.ZOHO_SMTP_PORT)) || DEFAULT_PORT,
  };
}

export function createNotifyTransport(config: NotifySmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // Port 465 is implicit SSL/TLS from the first byte; 587 starts plaintext
    // and upgrades via STARTTLS, which nodemailer handles when secure=false.
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    // A request is waiting on this — never let a stalled SMTP connection hold
    // the response open indefinitely.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

/** Minimal HTML escaping so user-supplied text can't break the markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
