# BUXENA — Review & Project-Proof Plan

Internal process note. The site's trust architecture is built and EMPTY by
design (`src/content/reviews/`, `src/content/projects/` — schemas in
`src/content.config.ts`). **No fake reviews, no fake projects, no stock
"customers", ever.** Empty collections render nothing in production;
nothing on the site pretends proof exists before it does.

## What the architecture already supports

- **Review**: customer first name/initial, city/state, product, ISO date,
  1–5 rating, `verifiedPurchase` flag, `photoPermission` flag.
- **Project**: title, model, location, images, `permissionStatus`
  (`granted-written` / `pending` / `none`), date.

A review or project goes live by adding one markdown file — no code work.

## Process, tied to the existing order pipeline

The admin order workflow already tracks Delivered → Installed. Hook the
proof process to those stages:

1. **Post-delivery review request** (order reaches Delivered + ~2 weeks):
   personal email from the founder — how is the sauna, one question, and a
   direct ask for a short review. Store the reply verbatim; never edit
   meaning, only trim with permission.
2. **Project-photo permission**: in the same email, ask whether BUXENA may
   photograph (or receive photos of) the installed sauna for the website.
   **Written permission (email reply counts) is required before any photo
   enters `src/content/projects/`** — record the date in the entry's
   `permissionStatus: granted-written` and keep the email.
3. **Testimonial usage permission**: explicit line in the ask: "May we
   publish this with your first name and town?" No publication without it.
4. **Referral request** (order reaches Installed): separate, later email —
   one line, no incentive claims until a referral policy is actually
   decided.
5. **Google review workflow**: once a Google Business Profile exists,
   include its direct review link as the low-friction option in step 1.
   Never gate or filter who gets the link (review-gating violates Google's
   policy and FTC guidance).
6. **Real project gallery**: an entry is publishable only when
   `permissionStatus: granted-written` AND the images pass the
   image-rights register (customer photos with written permission are
   APPROVED-class assets — record them in the register like any other).
7. **Verified-purchase flag**: set `verifiedPurchase: true` only when the
   reviewer matches a customer in the admin CRM.

## Compliance guardrails

- FTC: no incentivized reviews without disclosure; no cherry-picking that
  misrepresents typical experience.
- Never reuse customer project photos in ads without separately asking.
- Customers can withdraw permission — remove the entry within days, keep
  the register updated.

*Last updated 2026-08-10.*
