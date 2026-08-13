/**
 * Is lead capture in SAFE MODE — validate and acknowledge, but touch nothing
 * real?
 *
 * WHY THIS EXISTS
 * ---------------
 * The only guard was `import.meta.env.DEV`. Vite replaces that with a literal
 * `false` when building for production, so the entire safe branch is
 * dead-code-eliminated: the string `dev-mode-enquiry` does not appear anywhere
 * in the built Netlify function.
 *
 * The consequence is that a *branch preview* — the thing you deploy precisely
 * because it is not production — behaves exactly like production. Every form
 * submitted on it writes a real row to the live Supabase, sends a real staff
 * email through Zoho, pings the founders' Telegram, and uploads to the real
 * private bucket. A founder clicking through their own preview on a phone
 * would contaminate the CRM and mail themselves, and there was no way to ask
 * for anything else.
 *
 * `BUXENA_SAFE_MODE=true` gives a hosted build the same short-circuit local
 * dev has always had, so a staging preview can be walked end to end with
 * nothing written and nothing sent.
 *
 * READ AT RUNTIME, DELIBERATELY. `process.env.X` is looked up when the request
 * runs; `import.meta.env.X` is baked in at build time. Runtime lookup means
 * the flag can be flipped in the host's UI and takes effect on the next
 * request — no rebuild, no redeploy — which is the same reasoning the SMTP and
 * Telegram credentials already use. It also means safe mode cannot be
 * compiled away.
 *
 * FAILS SAFE ON THE PREVIEW, NOT ON PRODUCTION. Anything other than the exact
 * string "true" means live. That is the correct default for the production
 * site, where silently swallowing leads would be the worse failure — so the
 * flag must be set deliberately, and its absence is always the live path.
 */
export function isLeadSafeMode(): boolean {
  // Local `astro dev`, unless a developer has explicitly opted into live
  // services for a one-off integration test.
  if (import.meta.env.DEV && process.env.ENQUIRIES_DEV_LIVE !== 'true') return true;

  // Hosted staging preview.
  return String(process.env.BUXENA_SAFE_MODE ?? '').trim().toLowerCase() === 'true';
}

/**
 * A one-line description of why we are in safe mode, for server logs. Never
 * shown to a visitor — they see the form's own "test mode" confirmation.
 */
export function safeModeReason(): string {
  if (import.meta.env.DEV) return 'local dev server';
  return 'BUXENA_SAFE_MODE=true (hosted staging preview)';
}
