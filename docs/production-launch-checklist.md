# BUXENA V2 — Production Launch Checklist

Everything the live site needs to deliver leads, verified against the code
as of 2026-08-10. **No secrets appear in this file, ever.**

## Lead-delivery pipeline (as built)

Browser form → `POST /api/enquiries` (Netlify Function, server-side only)
→ Supabase `enquiries` table → activity log → email notification (Zoho
SMTP) + Telegram notification → visible in BUXENA Admin → Website
Enquiries. All seven public forms use this one path via
`src/lib/enquiry-client.ts`.

**Client-bundle safety: verified.** No environment variable is referenced
from any client-side script; `enquiry-client.ts` is key-free; Supabase,
SMTP and Telegram credentials are read only inside server code
(`supabase-admin.ts`, `send-enquiry-email.ts`, `notify-telegram.ts`,
`api/enquiries.ts`).

**Local development stays safe by design:** `astro dev` short-circuits
before any production service and returns a simulated capture
(`devMode: true`) — no env vars needed, nothing sent. Setting
`ENQUIRIES_DEV_LIVE=true` (plus real vars) is the only way dev can reach
live services, and that is an explicit opt-in.

## Required environment variables

Set in Netlify → Site settings → Environment variables. Names and
generation steps are documented in `.env.example`.

| Variable | Used by | Sensitivity | Local (.env) | Production | Risk if missing |
|---|---|---|---|---|---|
| `SUPABASE_URL` | server: enquiries + admin | low (URL) | **not set** | unknown — verify in Netlify | Forms fail with a controlled error; zero leads recorded |
| `SUPABASE_ANON_KEY` | server: /login auth | medium | **not set** | unknown | Admin sign-in fails; public site unaffected |
| `SUPABASE_SERVICE_ROLE_KEY` | server only: all data access | **SECRET — full DB access** | **not set** | unknown | Same as SUPABASE_URL; also admin data pages fail |
| `ZOHO_SMTP_USER` | server: enquiry email | low | not set | unknown | No email notification; lead still recorded in Supabase |
| `ZOHO_SMTP_PASSWORD` | server: enquiry email | **SECRET** (app password, MFA required) | not set | unknown | Same |
| `ZOHO_SMTP_HOST` | server: enquiry email | low — must be `smtp.zohocloud.ca` (Canadian DC; default smtp.zoho.com fails with 535) | not set | unknown | Email silently fails |
| `ENQUIRY_NOTIFY_TO` | server: enquiry email | low (defaults to info@buxena.com) | not set | unknown | Defaults apply |
| `TELEGRAM_BOT_TOKEN` | server: founders' group ping | **SECRET** | not set | unknown | No Telegram ping; lead + email unaffected |
| `TELEGRAM_CHAT_ID` | server: founders' group ping | low (negative group id) | not set | unknown | Same |

No analytics vendor variables exist yet by design — GA4/Meta/Pinterest IDs
are a launch-marketing decision; the dataLayer events are already firing
and will be picked up retroactively when a tag is added to BaseLayout.

## Launch test procedure (in order)

1. **Local dry run (no env):** submit every form on `npm run dev` — each
   must show the "Local test mode" success. (Passing as of this audit.)
2. **Local live run (optional):** create `.env` with the three Supabase
   vars + `ENQUIRIES_DEV_LIVE=true`; submit one Quote Form entry; confirm
   it appears in Admin → Website Enquiries; delete the test row.
3. **Netlify env:** confirm all variables above exist in the production
   site settings (values live only in Netlify + the founders' password
   manager).
4. **Deploy preview** (when deployment is approved — NOT before): submit
   one test enquiry per form type; confirm Supabase row + email +
   Telegram for each; delete test rows.
5. **Failure drill:** temporarily rename `SUPABASE_URL` in a preview
   context and confirm the form shows the inline error panel (not an
   alert, no data loss), then restore.

## Pre-launch gates outside this file

- Image rights: see `docs/image-rights-register.md` — 48 assets blocked.
- Pricing: see the pricing-readiness matrix in `docs/pricing-and-documents-readiness.md`.
- `public/media/buxena-hero-v2.png` still missing.

*Last updated 2026-08-10.*
