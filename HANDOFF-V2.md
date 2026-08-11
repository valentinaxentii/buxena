# BUXENA V2 — Status & Handoff

Last updated 2026-08-11. Branch `buxena-v2`. **Nothing deployed. V1 and `main` untouched.**

---

## Where things stand

| Area | Readiness | Note |
|---|---|---|
| Website | ~95% | Board 19/19 green |
| SEO | ~98% | One benign duplicate title vs a noindexed legacy route |
| Mobile | ~95% | 0 overflow, 0 a11y issues |
| Sales funnel | ~95% | Remaining 5% = live email, needs deploy |
| PDF / automation | ~98% | 35/35 identities correct |
| **Commercial** | **~35%** | 3 of 35 models have verified dealer cost |

---

## Completed V2 work

**Website & conversion** — cinematic homepage and hero (75s camera cycle, 3× amplitude), full-viewport hero with "Where Wellness Starts", scroll reveals across all sections, image optimization (WebP variants, ~90% lighter on mobile, native-width variants so desktop never upscales), sticky-CTA/chat collision fix, catalogue filter repair (root cause: `.pcard{display:flex}` beat `[hidden]`), Compare Your Sauna Quote section, How Buying Works page, Warranty & Ownership experience with natural-wood education + claim form.

**Lead pipeline** — 8 forms on one tested path (honeypot, rate limit, dev-mode short-circuit, CRM capture, staff email + Telegram). Customer acknowledgment email (founder-approved wording) carrying a link to the correct model presentation. Admin suggested-reply drafts. `lead_confirmed` conversion event on /thank-you/. 45 tracking events wired; **no vendor IDs installed** (none approved).

**Model presentations** — 3-page brochure generator + 35 PDFs. Each self-identifying via metadata stamped from the same record the cover is drawn from. 32/32 sellable pages link their own PDF; 3 held models excluded everywhere.

**Data architecture** — central pricing register (`src/data/pricing.ts`, **empty**); model identity map (public name, BUH code, manufacturer, supplier model, EXW class, container class, territory, image-rights, launch status); per-model warranty fields; `tsconfig.json`.

**Supplier intelligence** — manufacturers identified by spec-matching: CAPRA 24, WOOD ARCHITECTS 4, BALTRESTO 4, unidentified 3. Three unsent outreach drafts. Blanket asset-permission wording.

**Commercial analysis** — competitor research (22 competitors, 9 private quotes, indoor blind spot closed with 20 comparables); duty researched (HTS 9406.10.0000 MFN 2.6% + EU top-up to 15% ceiling — **not reducible**); container decision model with UNKNOWN handling; negotiation model back-calculating max payable EXW.

**Tooling** — `prelaunch-check.mjs` (19 checks), `verify-presentations.mjs`, `site-audit.mjs`, `container-model.mjs`, `negotiation-model.mjs`, `import-supplier-pricing.mjs`, `verify-env-integration.mjs`, `optimize-images.mjs`, `build-model-presentation.mjs`.

---

## Blockers

1. **Image/document permission — 0 of 35 in writing.** Biggest blocker; gates paid advertising. Wording ready in `docs/supplier-permission-wording.md`.
2. **Dealer EXW — 32 of 35 missing.** One Capra reply resolves 21.
3. **Preview deploy + one live email test** — needs Netlify access (see below).
4. **Duty confirmation** from a customs broker.
5. Seven logistics cost lines unquoted (destination, broker, drayage, warehousing, storage, insurance, CAC).

---

## Remaining launch tasks

- [ ] Trigger a **branch deploy** of `buxena-v2` in Netlify (NOT production)
- [ ] Run ONE controlled enquiry test to daxentii57@gmail.com — copy approved, see `docs/acknowledgment-test-preview.md`
- [ ] Verify: Supabase row, Zoho acknowledgment, staff notification, correct model, correct PDF link, no duplicate, clean logs
- [ ] Delete the test row afterwards
- [ ] Walk `docs/launch-checklists.md` on a real phone
- [ ] Add GA4/Meta IDs when approved (events already fire)

**Enquiries table is currently EMPTY** — the `FLOW TEST — DELETE` row was removed 2026-08-11, so any new row is the controlled test.

⚠️ **A Netlify preview is a production build with no dev-mode guard.** Any submission on it writes a real Supabase row and sends real email. Don't share the preview URL before launch.

---

## Supplier items pending

| Supplier | Contact | Models | Status |
|---|---|---|---|
| CAPRA | Andres Sokk · andres.sokk@capra.ee | 24 | Draft ready, **unsent** — send first |
| WOOD ARCHITECTS | Pijus Kazlauskas · pijus@woodarchitects.eu | 4 | Draft ready, **unsent** — US territory appears open |
| BALTRESTO | Anton Kostusjov · sales.manager@baltresto.com | 4 | Draft ready, **unsent** — BSaunas USA distributes their line; territory question asked first |

Drafts: `docs/{capra,wood-architects,baltresto}-pricing-request.md`

**Open decisions:** AURA appears in no supplier document (held; remove or keep after Capra replies) · VIRU spans two manufacturers (resolved internally, public names unchanged) · no price approved for publication.

---

## Exact next actions

1. **You:** Netlify → Deploys → Trigger deploy → branch `buxena-v2`. Send me the URL.
2. **You:** send the three supplier emails — they carry both pricing *and* permission requests.
3. **Then:** run the single controlled test, verify, delete the row.

---

## Key commands

```
npm run build                          # production build
node scripts/prelaunch-check.mjs       # 19-check launch board
node scripts/verify-presentations.mjs  # PDF mapping integrity
node scripts/site-audit.mjs            # SEO / a11y / perf / mobile
node scripts/container-model.mjs       # container economics (ranges)
node scripts/negotiation-model.mjs     # max payable EXW per model
node scripts/import-supplier-pricing.mjs <file> [--apply]   # supplier reply
node scripts/verify-env-integration.mjs                     # env, read-only
```

**Publishing a price** = one entry in `src/data/pricing.ts` (requires `approvedBy` + `approvedOn`) → appears on product page, cards, compare and sticky bar simultaneously.
