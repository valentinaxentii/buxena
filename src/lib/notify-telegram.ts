/**
 * Best-effort Telegram notification for new enquiries and leads.
 *
 * Runs ALONGSIDE the existing Zoho email notification, never instead of it —
 * email stays the durable record, Telegram is the fast phone alert that all
 * three founders see at once. Either channel failing leaves the other intact,
 * and neither can fail the request: the enquiry is already saved in Supabase
 * before these are called.
 *
 * Configuration (both required — either one missing means "skip Telegram"):
 *   TELEGRAM_BOT_TOKEN — from @BotFather in Telegram. SECRET: anyone holding it
 *                        can post as the bot. Never commit it, never log it.
 *   TELEGRAM_CHAT_ID   — the group to post into. Group ids are NEGATIVE and
 *                        look like -1001234567890; a personal chat id is a
 *                        positive number. Get it by adding the bot to the
 *                        group, sending any message, then reading
 *                        https://api.telegram.org/bot<TOKEN>/getUpdates.
 *
 * Uses Telegram's plain HTTPS Bot API via fetch — no SDK, no extra dependency.
 */

function pick(runtime: string | undefined, buildTime: unknown): string {
  const value = runtime ?? (typeof buildTime === 'string' ? buildTime : undefined);
  return (value ?? '').trim();
}

const procEnv: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

interface TelegramConfig {
  token: string;
  chatId: string;
}

/** Null when Telegram is unconfigured — callers should quietly skip. */
function getTelegramConfig(): TelegramConfig | null {
  // Runtime process.env wins over the build-time inlined value so a token
  // rotated in the Netlify UI takes effect without a rebuild; import.meta.env
  // is the fallback that makes `astro dev` work. Both accessors must be written
  // out statically — Vite can only inline `import.meta.env.SOME_NAME`.
  const token = pick(procEnv.TELEGRAM_BOT_TOKEN, import.meta.env.TELEGRAM_BOT_TOKEN);
  const chatId = pick(procEnv.TELEGRAM_CHAT_ID, import.meta.env.TELEGRAM_CHAT_ID);
  if (!token || !chatId) return null;
  return { token, chatId };
}

/**
 * Escapes the four characters Telegram's HTML parse mode treats as markup.
 * Without this a visitor typing "<3" or "R&D" would break the whole message —
 * Telegram rejects malformed HTML outright rather than rendering it literally.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** One "Label: value" line, or nothing at all when the value is empty. */
function line(label: string, value?: string | null): string | null {
  const v = value?.trim();
  return v ? `<b>${esc(label)}:</b> ${esc(v)}` : null;
}

async function send(text: string, context: string): Promise<void> {
  const config = getTelegramConfig();

  if (!config) {
    if (import.meta.env.DEV) {
      console.info(`[${context}] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — skipping Telegram.`);
    }
    return;
  }

  try {
    // A visitor is waiting on this request — never let a stalled Telegram API
    // call hold the response open. Matches the SMTP timeouts in notify-smtp.ts.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          parse_mode: 'HTML',
          // The message already contains everything worth seeing; a link
          // preview card would just push it off the notification.
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Telegram returns a JSON body explaining exactly what was wrong
        // (bad token, bot not in the group, wrong chat id). Worth logging —
        // it is the difference between "misconfigured" and "network blip".
        const detail = await res.text().catch(() => '');
        console.error(`[${context}] Telegram API ${res.status}: ${detail.slice(0, 300)}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    // Logged to the Netlify function logs only. Never surfaced to the visitor,
    // never rethrown — the record is already saved and the email already sent.
    console.error(`[${context}] Telegram send failed:`, err);
  }
}

export interface EnquiryTelegramInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  message?: string | null;
  saunaInterest?: string | null;
  source?: string | null;
}

export async function sendEnquiryTelegram(input: EnquiryTelegramInput): Promise<void> {
  const source = input.source?.trim() || 'Website';
  const message = input.message?.trim();

  const text = [
    `🔔 <b>New enquiry — ${esc(source)}</b>`,
    '',
    line('Name', input.name) ?? '<b>Name:</b> —',
    line('Email', input.email),
    line('Phone', input.phone),
    line('ZIP / Location', input.location),
    line('Model / request', input.saunaInterest),
    message ? `\n<b>Message</b>\n${esc(message)}` : null,
    '',
    '<i>Also in BUXENA Admin → Website Enquiries</i>',
  ]
    .filter((l) => l !== null)
    .join('\n');

  await send(text, 'enquiry-telegram');
}

export interface LeadTelegramInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  source?: string | null;
  modelName?: string | null;
  budget?: number | null;
  timeline?: string | null;
  createdBy?: string | null;
}

export async function sendLeadTelegram(input: LeadTelegramInput): Promise<void> {
  const budget =
    input.budget != null && Number.isFinite(input.budget)
      ? `$${input.budget.toLocaleString('en-US')}`
      : null;

  const text = [
    `📋 <b>New lead — ${esc(input.source?.trim() || 'Manual')}</b>`,
    '',
    `<b>Name:</b> ${esc(input.name)}`,
    line('Email', input.email),
    line('Phone', input.phone),
    line('State', input.state),
    line('Model', input.modelName),
    line('Budget', budget),
    line('Timeline', input.timeline),
    line('Added by', input.createdBy),
    '',
    '<i>Also in BUXENA Admin → Leads</i>',
  ]
    .filter((l) => l !== null)
    .join('\n');

  await send(text, 'lead-telegram');
}
