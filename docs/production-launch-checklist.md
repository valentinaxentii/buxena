# BUXENA V2 — Production Launch Checklist

Current launch-readiness reference for the `buxena-v2` branch. **No secrets appear in this file, ever.**

## Lead-delivery pipeline (as built)

Browser form → `POST /api/enquiries` (Netlify Function, server-side only)
→ Supabase `enquiries` table → activity log → email notification (Zoho SMTP)
+ Telegram notification → visible in BUXENA Admin → Website Enquiries.

Public enquiry handling now includes server-side validation, request-size and
field-length limits, source normalization to the database schema, rate limiting,
honeypot handling, generic public error responses, and best-effort email /
Telegram / customer acknowledgment notifications after the row is recorded.

**Client-bundle safety:** credentials remain server-only. Supabase service-role,
SMTP and Telegram secrets are not exposed to client code.

**Local development stays safe by design:** `astro dev` short-circuits before
production services unless `ENQUIRIES_DEV_LIVE=true` is deliberately set.

## Required environment variables

Set in Netlify → Site settings → Environment variables. Names and generation
steps are documented in `.env.example`.

| Variable | Used by | Sensitivity | Required for launch |
|---|---|---|---|
| `SUPABASE_URL` | enquiries + admin | low | **YES** |
| `SUPABASE_ANON_KEY` | admin authentication | medium | **YES** |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only database operations | **SECRET** | **YES** |
| `ZOHO_SMTP_USER` | staff + customer email | low | **YES** |
| `ZOHO_SMTP_PASSWORD` | SMTP authentication | **SECRET** | **YES** |
| `ZOHO_SMTP_HOST` | Zoho Canadian DC | low | **YES** — `smtp.zohocloud.ca` |
| `ENQUIRY_NOTIFY_TO` | staff notification destination | low | optional |
| `TELEGRAM_BOT_TOKEN` | founder notification | **SECRET** | optional |
| `TELEGRAM_CHAT_ID` | founder group | low | optional |

`ENQUIRIES_DEV_LIVE` is local-only and must not be set in Netlify.

## Automated verification

The branch includes:

- `npm run check` — Astro/TypeScript validation.
- `npm run security:audit` — authorization, public error handling, request
  bounds, source normalization, password-reset throttling, upload behavior and
  database-hardening regression checks.
- `npm run build` — production Astro build.
- `node scripts/prelaunch-check.mjs --skip-build` — generated routes, internal
  links/images, SEO metadata, sitemap/robots, zero-price freeze, dev-mode form
  sources, acknowledgment behavior, honeypot behavior, key buyer journeys and
  blocked/watermarked imagery checks.
- `.github/workflows/v2-ci.yml` runs the sequence above when GitHub Actions is
  available for the repository.

## Security state

Application-side fixes now present on V2:

- `/admin/settings*` fails closed when the role cannot be verified.
- Settings and Staff Account pages independently verify admin access before
  service-role operations.
- Public enquiry failures return generic visitor-safe messages rather than raw
  Supabase/internal errors.
- Enquiry payload size and field lengths are bounded.
- Public enquiry source labels are normalized to the database enum.
- Password-reset requests are rate limited.

Database hardening is prepared in `supabase/security-hardening.sql` for the live
Supabase advisor findings. It must be reviewed/applied separately to the live
database; the presence of the file does not mean the live database has already
been changed.

## Project upload state

The project-upload UI supports click selection and real drag/drop without the
browser navigating away. Accepted file type/size is validated in the browser.
For privacy, customer project files remain **metadata-only** until a deliberately
private Storage bucket and server upload policy are approved. The current live
BUXENA Supabase project has no Storage buckets, so there is no accidental public
customer-file bucket in use.

## Hero media

The older checklist item saying `public/media/buxena-hero-v2.png` was missing is
superseded. The active Hero component expects and currently has:

`public/media/buxena-hero-v2.jpg`

That JPG is the approved BUXENA concept visual referenced by `Hero.astro`. The
older undocumented `hero.mp4` remains rights-blocked and is not rendered.

## Launch test procedure

1. Run the automated checks above.
2. Confirm the required Netlify variables exist in the correct preview context.
3. Deploy a **preview only after founder approval**.
4. Submit one controlled enquiry using a founder-owned test email.
5. Confirm the row appears in Admin → Website Enquiries and the expected email /
   optional Telegram notifications arrive.
6. Verify password-reset redirect configuration in Supabase Authentication.
7. Delete only the explicitly identified test data after verification.
8. Production deployment requires separate explicit founder approval.

## Remaining commercial / launch gates

- Image rights: use `docs/image-rights-register.md` as the source of truth.
  Capra imagery has website/product-page permission recorded; VIRU/NORD and any
  other blocked imagery need written permission or safe replacement before
  production reliance.
- Pricing: use `docs/pricing-and-documents-readiness.md`; no unapproved public
  pricing should be inserted.
- Supplier/dealer EXW, landed-cost inputs, compliance documentation and actual
  availability remain commercial inputs and must not be guessed in website
  copy.
- GitHub Actions execution still needs to be observed successfully; workflow
  code being present is not proof that CI has run.

*Updated 2026-08-12.*
