# BUXENA V2 — Release Candidate Status

Last updated **2026-08-13**. Branch **`buxena-v2`**.
**Nothing deployed. `main` / V1 untouched at `e3b457d`.**

---

## Verified state

| | |
|---|---|
| Astro check | **0 errors, 0 warnings** (235 files) |
| Unit tests | **100 / 100** |
| Pre-launch board | **24 / 24 GREEN** |
| Site audit | 0 SEO · 0 accessibility · 0 performance · 0 mobile-risk |
| Catalogue readiness | **32 / 32 published models clean** |
| Anchor CTAs | 598 checked, all resolve |
| Live CRM persistence | **12 / 12 forms create manageable records** |
| Conversion (enquiry→lead→quote) | **13 / 13 checks** |
| Public assets with unknown owner | **0** |

Every number above was produced by a script in this repo and can be re-run.
Nothing here was verified by eye in a browser — see *Not verified* below.

---

## The one thing that is NOT a code problem

`enquiries.source` in the live database still carries a five-value CHECK
constraint while the site sends twelve. **Confirmed against production**, not
inferred: `node scripts/check-enquiry-sources.mjs` inserts one row per source
and reports 3 accepted, 9 rejected, then removes what it created.

It is **not a launch blocker** because the API detects that specific constraint
and retries with an accepted source, writing the true form name into the
message where `effectiveSource()` reads it back. All twelve forms produce a
manageable CRM record either way. Applying
`supabase/migrations/2026-08-13-enquiry-source-constraint.sql` removes the
workaround; until then the enquiry detail page states plainly what was stored
and why.

---

## Completed in this build

**Lead capture** — twelve public forms on one path with two independent capture
routes (database row, staff email + Telegram); a lead is only ever declared
lost when all three fail. The quote form's two steps merge into one enquiry
instead of creating two unlinked rows, and the customer's uploaded files land on
the record staff actually open. Field lengths capped server-side.

**Admin** — enquiries ranked by who is waiting on a human, deep-linked from the
dashboard, with waiting time shown; project answers parsed out of the message
into a readable grid; other enquiries from the same email surfaced; converted
leads and customers carry the real originating form.

**Security** — stored XSS in the admin panel, writable from any public enquiry
form, found and fixed: `JSON.stringify` inside `set:html` does not escape `<`,
so a crafted customer name could run script in a staff session. All fourteen
script payloads now go through `jsonForScript()`, with tests and a board guard.
Admin routes refuse anonymous GET and POST including `/admin/api/*`; auth fails
closed on a lookup error; no secret reaches any client bundle; open-redirect
edge closed.

**Image rights** — 25 publicly-served images with no identifiable owner removed;
0 remain. See below.

**Pricing architecture** — one register entry propagates to product page, cards,
compare, sticky bar and `AggregateOffer` structured data. Verified by publishing
a temporary price, reading all five surfaces, and removing it.

---

## Image rights

**Launch-blocking (unsourced): 25 → 0.**

30 original assets are publicly served, every one with a documented owner:

| Group | Count | Status |
|---|---|---|
| Capra dealer-pack + ELLA/ILLI/ALLA heroes | 13 | **Website APPROVED** in writing · ads/social need confirmation |
| BUXENA-owned (`og-brand-card`, `buxena-hero-v2`) | 2 | **APPROVED** |
| VIRU (Baltresto ×4, Wood Architects ×2) | 6 | Supplier-identifiable — **paid-advertising blocker** |
| NORD Cube (Wood Architects) | 4 | Supplier-identifiable — **paid-advertising blocker** |
| Ritual Kit accessories | 5 | Supplier-identifiable — **paid-advertising blocker** |

**Consequence to be aware of:** the 16 EDA barrel pages now render a designed
toned ground instead of a photograph. Their files stay on disk and the reason is
in each frontmatter — restoring is one line per model once Capra sends imagery
with permission. `scripts/catalogue-readiness.mjs` names them on every run.

The homepage Ritual band is now typographic rather than photographic. It reverts
to `<Figure>` in one edit when licensed photography exists.

---

## Pricing

`src/data/pricing.ts` is **empty and must stay empty** until a founder approves
exact figures. The file carries the approved launch policy: UKU 160 and UKU 230
are eligible for "From" pricing; **ELLA H2 is held** (its old admin cost
conflicts with documented landed cost, and its worksheet flags a specification
mismatch on the live page); everything else is Request Quote.

The **UKU 230 half-moon is a separate supplier SKU** (EUR 2,590 vs EUR 2,240).
`SEPARATE_SKU_VARIANTS` makes it impossible to publish one price covering both —
the caveat renders automatically, but only once a price exists.

**The 15% duty rate is an assumption**, never to be shown publicly as
confirmed. Verified that no cost basis — landed cost, EXW, duty, margin, or any
supplier EUR figure — reaches any public page.

---

## Supplier outreach — drafted, NOT SENT

| Supplier | Contact | Models | File |
|---|---|---|---|
| CAPRA | Andres Sokk · andres.sokk@capra.ee | 24 | `docs/capra-pricing-request.md` |
| BALTRESTO | Anton Kostusjov · sales.manager@baltresto.com | 4 | `docs/baltresto-pricing-request.md` |
| WOOD ARCHITECTS | Pijus Kazlauskas · pijus@woodarchitects.eu | 4 | `docs/wood-architects-pricing-request.md` |

Each asks for dealer/EXW pricing, MOQ, lead time, availability process, crate
dimensions and weights, heater inclusion, warranty, territory, MAP/MSRP, and
image permission split across website / social / organic / paid / crop-resize.

**Capra is priority #1** — one reply unblocks EXW for 21 models, paid-ad
permission on 24, the EDA configurator, EDA photography, and the crate
dimensions every margin figure currently assumes.

**Baltresto leads with the territory question** — BSaunas USA already
distributes their line. If the U.S. is closed, four published models lose their
supplier and should come off the site.

---

## Not verified

**No real browser or device testing happened.** The Chrome extension was not
connected in any session. Mobile behaviour is inferred from CSS analysis
(no fixed widths above 390px), the audit's viewport and overflow checks, and
responsive rules in the source — **not from looking at it**. A real-phone pass
remains outstanding.

---

## Deployment

**Not authorised. Not attempted.** No preview, no staging, no production.
Required environment variables, the staging procedure, the post-deploy smoke
test and the rollback plan are in `docs/production-launch-checklist.md` and
`docs/launch-checklists.md`.

---

## Founder decisions already made — do not re-litigate

1. Hybrid pricing: UKU 160 / UKU 230 eligible, ELLA H2 held, rest Request Quote.
2. No price published without explicit founder approval of exact numbers.
3. UKU 230 half-moon is a separate commercial SKU.
4. The 25 unsourced images are not acceptable — do not launch with them.
5. Supplier-owned identifiable images may stay on the website but not in paid ads.
6. "OKU" was a typo; the model line is **UKU**.
7. No phone number until a real BUXENA number exists.
8. Supplier emails await founder review — **do not send**.
