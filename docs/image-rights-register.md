# BUXENA — Image Rights Register

Audit of every customer-facing image asset in `public/`, against the
copyright/licensing risk called out in the V2 build brief.

**Method**: every file's origin was traced via `git log --follow` to the
commit that introduced it, cross-referenced against that commit's message
(where the author left sourcing notes) and `public/images/README.md`'s own
"only use photography you own or have licensed" rule.

**Rule applied**: nothing is deleted or unpublished by this audit alone.
Anything with unverified or clearly third-party sourcing is marked
**BLOCKED / REPLACE** so a safe replacement can be swapped in quickly —
per the brief, irreplaceable assets stay live until a replacement exists,
they are just clearly flagged here first.

**Owner of record for this whole register**: BUXENA (Valentina/founders) —
approval decisions below are BUXENA's to make, not inferred.

---

## Legend

- **Approved** — commercial use on buxena.com confirmed safe.
- **BLOCKED / REPLACE** — commercial usage rights not conclusively
  documented. Per the founders' ruling (2026-08-10): permission is never
  assumed; these must not ship in the launch-ready V2. Existing placements
  stay in the layout only until replacement imagery exists — the Figure
  component renders a labelled placeholder the moment an image's `src` is
  removed, so swaps are one-line changes.

> **Founders' ruling, 2026-08-10** — applied throughout this register:
> any image whose rights cannot be conclusively documented is BLOCKED /
> REPLACE, no exceptions. The former "VERIFY" status is retired; an
> undocumented origin is treated as unlicensed until written proof exists.

> **CORRECTION — Capra, 2026-08-10 (second ruling, from Valentin after
> checking the Gmail correspondence):** Capra gave BUXENA **written
> permission to use the shared-drive images on the BUXENA website for
> marketing**. Therefore, for every image traceable to the Capra shared
> drive (the `CAPRA-…zip` Google Drive export) or the BUXENA-branded
> ELLA/ILLI/ALLA catalog, rights are now SPLIT BY USE:
> - **WEBSITE / PRODUCT PAGES: APPROVED** (written permission on file in Gmail)
> - **PAID ADVERTISING: NEEDS CONFIRMATION**
> - **SOCIAL MEDIA: NEEDS CONFIRMATION**
> - **LOGO OVERLAYS / HEAVY EDITING: NEEDS CONFIRMATION**
> This applies to the ELLA/ILLI/ALLA site heroes (visually derived from
> the same drive/catalog renders, though not byte-identical — re-export
> from drive originals if strict provenance is ever needed), the
> dealer-pack cutouts in `supplier-capra/`, and any future exact-model
> image taken from the drive. It does NOT cover EDA/AURA/ITI heroes (not
> traceable to the drive — the drive's EDA folder is empty), VIRU
> (different supplier, permission still pending), NORD (Wood Architects,
> pending), or the lifestyle/hero-video group. Exact-model rule stands:
> never use a supplier image for a model it doesn't depict.

---

## 1. Brand assets — `public/brand/*`

| Filename | Used where | Source | Owner | License | Commercial use | Approved | Notes |
|---|---|---|---|---|---|---|---|
| `buxena-logo.png`, `buxena-logo-transparent.png`, `buxena-logo-white.png`, `buxena-logo-espresso.png`, `buxena-logo-champagne.png`, `buxena-logo-champagne-header.png`, `buxena-logo-compact.png`, `buxena-logo-header-dark.png`, `buxena-horizontal.png`, `buxena-horizontal-light.png`, `buxena-stacked.png`, `buxena-stacked-light.png`, `buxena-icon.png`, `buxena-icon-circle.png`, `buxena-mark.png`, `buxena-wordmark-mark.png` | Header, footer, chat widget, admin, login, PDF quotes, "coming soon" splash | BUXENA's own commissioned logo/brand artwork | BUXENA | Owned outright | Yes | **Yes** | Explicitly pre-approved per the build brief. No action needed. |

---

## 2. Sauna product photography — `public/images/saunas/*`

### 2a. ELLA / ILLI / ALLA / EDA / AURA / ITI series — 21 files

`alla-h1-hero.png`, `alla-h2-hero.png`, `aura-thermowood-1-3m-hero.jpeg`,
`ella-h1-hero.png`, `ella-h2-hero.png`, `illi-h1-hero.png`,
`illi-h2-hero.png`, `iti-thermowood-2-3m-hero.png`, and all 12
`eda-*-hero.{png,jpeg}` files.

| Field | Value |
|---|---|
| Used where | Respective model's product page (`/saunas/<slug>/`), homepage featured cards, related-model cards |
| Source | Unknown — bundled into the repo in commit `9562ea1` ("accumulated across prior sessions that had never been committed"), no sourcing note in any commit message |
| Owner | Undocumented |
| License | None documented |
| Commercial use | **BLOCKED / REPLACE** |
| Approved | **No** |
| Notes | Largest single group (21 files, ~40% of live product imagery). If written proof of ownership or license surfaces (BUXENA shoot, purchased media kit, supplier grant), individual files can be re-marked Approved with the proof reference. Until then: replace before launch. |

### 2b. VIRU barrel series — 7 files

`viru-thermowood-2-4m-hero.jpg`, `viru-thermowood-3-0m-hero.jpg`,
`viru-thermowood-3-6m-hero.jpg`, `viru-thermowood-4-0m-hero.jpg`,
`viru-vertical-2-6m-hero.jpg`, `viru-panorama-5-0m-hero.jpg`,
`viru-grand-6-0m-hero.jpg`

| Field | Value |
|---|---|
| Used where | Respective VIRU product pages, homepage/collection cards |
| Source | Supplier's own **public product gallery** (dealer relationship, not a licensed media kit) — per commit `24f4c56`: "formal hi-res pack and written image permission requested **in parallel**" (i.e. requested, not yet granted at time of writing) |
| Owner | The supplier / original photographer |
| License | **Not confirmed** — permission was requested, grant status unknown as of this audit |
| Commercial use | **BLOCKED** until written permission is confirmed |
| Approved | **No** |
| Notes | Follow up with the supplier on the written permission request before this goes live under V2. If granted, update this row to Approved with the grant reference (email/contract date). If declined or unanswered, commission or license replacement photography before scaling ad spend on these models. |

### 2c. NORD Cube series — 4 files

`nord-cube-200-hero.jpg`, `nord-cube-200-interior.jpg`,
`nord-cube-240-hero.jpg`, `nord-cube-240-interior.jpg`

| Field | Value |
|---|---|
| Used where | NORD Cube 200/240 product pages |
| Source | "Extracted from the supplier's 2026 collection catalog" (commit `6954c96`) — a PDF/print catalog, not a granted media license |
| Owner | The supplier |
| License | **None documented** |
| Commercial use | **BLOCKED** |
| Approved | **No** |
| Notes | Same category as VIRU but with no permission request on record at all. Needs the same written-permission ask, or replacement photography, before being relied on for paid acquisition. |

---

## 3. Ritual Kit accessory photography — `public/images/accessories/*` (5 files)

`kit-bucket.jpg`, `kit-fragrance.jpg`, `kit-headrest.jpg`,
`kit-thermometer.jpg`, `kit-timer.jpg`

| Field | Value |
|---|---|
| Used where | `RitualKit.astro` — rendered on every sauna product page |
| Source | "Supplier shop photography, optimised to 480px squares" (commit `478486b`) |
| Owner | The supplier's e-commerce store |
| License | **None documented** |
| Commercial use | **BLOCKED** |
| Approved | **No** |
| Notes | Lowest visual prominence (small accessory thumbnails) but same underlying problem — lifted from a supplier storefront without a recorded grant. Cheapest group to replace with real BUXENA-shot product photography since the accessories are small and included with every order. |

---

## 4. Site / lifestyle imagery — `public/images/*` (top-level, 9 files)

`collection-barrel.jpg`, `collection-indoor.jpg`,
`craftsmanship-detail.jpg`, `our-story-sauna.jpg`, `ritual-01-loyly.jpg`,
`ritual-02-cooling.jpg`, `ritual-03-rest.jpg`, `wellness-etiquette.jpg`,
`wellness-ritual.jpg`, `og-default.jpg`

| Field | Value |
|---|---|
| Used where | Homepage collection tiles, Our Story page, Wellness page, Ritual band, default social-share (OG) image |
| Source | Unknown — bundled in `9562ea1` alongside the undocumented sauna photography (§2a), no sourcing note |
| Owner | Undocumented |
| License | None documented |
| Commercial use | **BLOCKED / REPLACE** |
| Approved | **No** |
| Notes | `og-default.jpg` is the priority replacement: it is the image every shared link (social, iMessage, Slack) shows. A safe interim is a BUXENA-brand OG card (logo on ember ground) built from approved brand assets. |

---

## 5. Hero video — `public/media/hero.mp4` (1 file)

| Field | Value |
|---|---|
| Used where | Homepage `Hero.astro`, full-bleed autoplay background |
| Source | Unknown — bundled in `9562ea1`, no sourcing note. No fallback `hero.jpg` currently exists in `public/images/` |
| Owner | Undocumented |
| License | None documented |
| Commercial use | **BLOCKED / REPLACE** |
| Approved | **No** |
| Notes | **NO LONGER RENDERED (2026-08-10, founders' order).** Hero.astro's rights gate (`RIGHTS_CLEARED = false`) keeps this video out of the page in both dev and production; the file stays on disk untouched in case rights are later documented. The hero currently shows a **BUXENA-authored pure-CSS concept visual** (ember dusk gradient + warm glow + slat motif, slow drift) — rights unambiguous, authored in `Hero.astro` itself; it depicts no product and is never captioned as a real installation. In dev it carries a visible "Temporary concept visual" tag. When licensed footage arrives: register it here as APPROVED, place it at `public/media/hero.mp4`, set `RIGHTS_CLEARED = true`. |

---

## Summary

| Group | Files | Status |
|---|---|---|
| Brand assets | 16 | Approved |
| ELLA/ILLI/ALLA hero renders (8 files) | 8 | WEBSITE APPROVED (Capra written permission) · ads/social NEEDS CONFIRMATION |
| EDA/AURA/ITI hero photos (13 files) | 13 | BLOCKED / REPLACE (not traceable to the Capra drive) |
| VIRU hero photos | 7 | BLOCKED / REPLACE (permission requested, not confirmed) |
| NORD Cube photos | 4 | BLOCKED / REPLACE (no permission on record) |
| Ritual Kit accessory photos | 5 | BLOCKED / REPLACE |
| Lifestyle/site imagery | 10 | BLOCKED / REPLACE |
| Hero video | 1 | BLOCKED / REPLACE |
| **Total blocked (non-brand)** | **48** | **0 approved** |

**Launch gate**: per the founders' ruling, none of these 48 assets ships
in the launch-ready V2 unless its rights are conclusively documented
first. The site's Figure/Hero components already degrade gracefully to
placeholders, so pulling an image is a one-line frontmatter change per
model when the launch decision is made — the layout never breaks. If a
supplier grant arrives (e.g. the VIRU written-permission request), update
that group's row with the proof reference and re-mark it Approved.

---

## 6. Approved generated hero — `public/media/buxena-hero-v2.jpg`

| Field | Value |
|---|---|
| Filename | `buxena-hero-v2.jpg` |
| Used where | Homepage hero (`Hero.astro`) |
| Source | BUXENA commissioned/generated concept visual |
| Owner | BUXENA |
| License | BUXENA-owned generated asset |
| Commercial use | Yes |
| Status | **APPROVED — GENERATED CONCEPT VISUAL** |
| Notes | **Internal rule: this is concept/lifestyle imagery. It must NOT be represented as an actual completed BUXENA customer installation or as an exact supplier product model** — no captions, alt text, ads or social posts implying it is a real project. Composition: dark negative space left (headline zone), sauna right. **As of 2026-08-10 the file has NOT yet been placed in `public/media/`** — Hero.astro auto-detects it at build time and renders it the moment it exists; until then the CSS concept scene stands in. |

---

## 7. CAPRA dealer-pack renders — `public/images/catalog/*`

| Field | Value |
|---|---|
| Files | `ella-h2-indoor-cutout.png`, `aapo-spruce-cutout.png` (optimized copies) |
| Used where | Admin product panels (internal); candidates for website product pages |
| Source | CAPRA official dealer pack, provided directly to BUXENA (`CAPRA-20260726T…zip`, received Jul 26 2026) — exact-model 3D renders with transparent backgrounds |
| Owner | Capra (renders); pack supplied to BUXENA as dealer materials |
| License | Dealer-pack materials supplied for dealer marketing use. **Internal admin use: fine. Public website/ad use: strong provenance, but confirm in writing with Capra** ("we may use dealer-pack images on buxena.com and in advertising") to close the loop |
| Status | **WEBSITE APPROVED** (Capra written permission, per Valentin 2026-08-10) · paid ads / social / heavy edits NEEDS CONFIRMATION |
| Notes | Only exact-model matches were used: ELLA H2 indoor render for ELLA H2, AAPO spruce render for AAPO. H1 products deliberately NOT given H2 renders — never present an image as a model it isn't. The same pack + the BUXENA-branded ELLA/ILLI/ALLA catalog materially improves provenance for the existing ELLA/ILLI/ALLA site heroes too. |

---

## Per-placement map — V2 as currently built (audited 2026-08-10, second pass)

Every customer-facing image placement in the V2 build, by page. Status
refers to the file's group entry above. "Local preview only" = visible now
for design review, **not launch-safe**.

### Homepage (`/`)

| Placement | File | Product | Status |
|---|---|---|---|
| Hero background | `media/buxena-hero-v2.jpg` (§6; auto-renders once file is placed — CSS concept scene stands in meanwhile) | — | **APPROVED — GENERATED CONCEPT VISUAL** |
| Choose tile — Outdoor | `images/collection-barrel.jpg` | — | BLOCKED / REPLACE |
| Choose tile — Cube | `images/saunas/nord-cube-200-hero.jpg` | NORD Cube 200 | BLOCKED / REPLACE (supplier catalog, no permission) |
| Choose tile — Barrel | `images/saunas/eda-nordic-spruce-2-5m-hero.png` | EDA Nordic Spruce 2.5m | BLOCKED / REPLACE (origin undocumented) |
| Choose tile — Indoor | `images/collection-indoor.jpg` | — | BLOCKED / REPLACE |
| Featured — ELLA H2 | `images/saunas/ella-h2-hero.png` | ELLA H2 | WEBSITE APPROVED (Capra permission) · ads NEEDS CONFIRMATION |
| Featured — ILLI H2 | `images/saunas/illi-h2-hero.png` | ILLI H2 | WEBSITE APPROVED (Capra permission) · ads NEEDS CONFIRMATION |
| Featured — EDA 2.5m | `images/saunas/eda-nordic-spruce-2-5m-hero.png` | EDA Nordic Spruce 2.5m | BLOCKED / REPLACE |
| Wellness — Heat | `images/ritual-01-loyly.jpg` | — | BLOCKED / REPLACE |
| Wellness — Cool | `images/ritual-02-cooling.jpg` | — | BLOCKED / REPLACE |
| Wellness — Rest | `images/ritual-03-rest.jpg` | — | BLOCKED / REPLACE |
| Header/footer/hero logos | `brand/*` | — | **APPROVED** |

### Product pages (`/saunas/<slug>/`)

Every model's hero image (35 files across 33 pages) — status per group
§2a–2c above: **all BLOCKED / REPLACE**. Plus on every product page:

| Placement | Files | Status |
|---|---|---|
| Ritual Kit band (5 thumbnails) | `images/accessories/kit-*.jpg` | BLOCKED / REPLACE (supplier shop photography) |

### Collection pages (`/saunas/*-saunas/`, `/saunas/`, `/collections/*`)

Product-card thumbnails reuse the same hero files as the product pages —
same statuses, no additional files.

### Other pages

| Page | File | Status |
|---|---|---|
| Our Story | `images/our-story-sauna.jpg` | BLOCKED / REPLACE |
| Wellness | `images/wellness-ritual.jpg`, `images/wellness-etiquette.jpg` | BLOCKED / REPLACE |
| Social shares (every page) | `images/og-brand-card.jpg` — **APPROVED** (generated 2026-08-10 from approved logo assets only, `scripts/make-og-card.mjs`; replaced rights-unknown `og-default.jpg`, which is no longer referenced) | — | APPROVED |
| Advisor results / compare | model hero files (as above) | BLOCKED / REPLACE |
| See It In My Space matches (`/see-it-in-my-space/`) | model hero files (as above) | BLOCKED / REPLACE |
| Customer-uploaded space photos | never stored server-side in this MVP (client-side only); PRIVATE project data — never marketing imagery | n/a — see privacy note in `see-it-in-my-space.astro` |

### Audit report (2026-08-10)

| Metric | Count |
|---|---|
| Total image files audited | 64 |
| APPROVED (brand assets) | 16 |
| VERIFY | 0 — status retired per founders' ruling; undocumented = BLOCKED |
| BLOCKED / REPLACE | 48 |

**Homepage images currently visible that are NOT launch-safe (11):**
`hero.mp4`, `collection-barrel.jpg`, `nord-cube-200-hero.jpg`,
`eda-nordic-spruce-2-5m-hero.png`, `collection-indoor.jpg`,
`ella-h2-hero.png`, `illi-h2-hero.png`, `ritual-01-loyly.jpg`,
`ritual-02-cooling.jpg`, `ritual-03-rest.jpg`, `og-default.jpg` (in meta
tags rather than on-page).

No approved replacement exists yet for any blocked file, so none were
swapped — all remain **local preview only** per the founders' rule 8.
Replacement sourcing order per the founders: official supplier photography
with written permission (product pages); licensed commercial stock or
BUXENA-generated concept imagery (lifestyle) — concept imagery must be
labelled internally as concept and never presented as a real completed
BUXENA project.

---

## REPLACEMENT MAP — ranked by sales importance (launch-blocker pass, 2026-08-10)

Allowed replacement sources, per the founders: BUXENA-owned photography,
BUXENA-generated concept visuals (never presented as real installations),
supplier photography with documented written permission, or properly
licensed commercial stock. Nothing else.

### P0 — directly gates conversion (replace first)

| Placement | Blocked file(s) | Fastest safe path |
|---|---|---|
| Homepage hero | `hero.mp4` (unrendered) — awaiting `buxena-hero-v2.jpg` | **Drop the already-approved generated file into `public/media/`** — zero further work |
| Featured models (ELLA H2, ILLI H2, EDA 2.5m) | `ella-h2-hero.png`, `illi-h2-hero.png`, `eda-nordic-spruce-2-5m-hero.png` | Supplier written permission for these 3 exact images, or 3 generated concept product visuals labeled as concept |
| Master product page (NORD Cube 200) | `nord-cube-200-hero.jpg`, `nord-cube-200-interior.jpg` | Supplier permission (catalog images already identified) — one email |
| Social share default | `og-default.jpg` | **Buildable today**: brand OG card from approved logo assets — no external rights needed |

### P1 — homepage/category imagery

| Placement | Blocked file(s) | Fastest safe path |
|---|---|---|
| Choose-tiles (Outdoor/Cube/Barrel/Indoor) | `collection-barrel.jpg`, `nord-cube-200-hero.jpg`, `eda-nordic-spruce-2-5m-hero.png`, `collection-indoor.jpg` | Covered by P0 supplier asks + 2 licensed stock/generated lifestyle scenes |
| Remaining product heroes (29 files) | EDA/VIRU/ALLA/AURA/ITI ranges | One written-permission request per supplier covering their whole public gallery — 2 emails cover ~28 files |

### P2 — editorial/supporting

| Placement | Blocked file(s) | Fastest safe path |
|---|---|---|
| Wellness ritual trio + wellness page | `ritual-01/02/03`, `wellness-*.jpg` | Licensed stock or generated concept scenes — no product accuracy required |
| Our Story | `our-story-sauna.jpg` | Same |
| Ritual Kit thumbnails | `kit-*.jpg` (5) | BUXENA-shot photos of the actual accessories (they're physical stock items — cheapest real shoot on the list) |

**No blocked image currently has an approved replacement in the project**,
so none were swapped this pass — safe placeholders/graceful degradation
remain in place everywhere, and the register stays the launch gate.

*Last updated: 2026-08-10 (launch-blocker pass — replacement map added). Re-run this audit whenever new photography is added — see `public/images/README.md` for the "only use photography you own or have licensed" house rule going forward.*

---

## Homepage category cards — added 2026-08-11

| File | Placement | Status |
|---|---|---|
| `images/collections/outdoor.png` | Outdoor Saunas card | **UNVERIFIED** — provenance not documented; treat as BLOCKED until licensed |
| ~~`images/collections/cube.png`~~ | ~~Cube Saunas card~~ | ✅ **RESOLVED 2026-08-12 — file deleted.** Carried a visible Dreamstime watermark. Removed from the repo entirely, not just unreferenced: everything under `public/` is served on the production domain whether or not a page links to it, so an unreferenced watermarked file is still a published one. Recoverable from git history if ever needed |
| `images/saunas/nord-cube-200-hero.jpg` | Cube Saunas card (replacement, 2026-08-12) | 🟠 **UNLICENSED — BLOCKED / REPLACE** (supplier catalog, no permission on record). No watermark. Same blocked status as the other three cards; this swap removed a visible stock mark, it did **not** clear the licensing blocker. Already used on the NORD Cube 200 product page and the Plan Your Sauna choose-tile, so it adds no new permission exposure — it is covered by the same CAPRA ask |
| `images/collections/barrel.png` | Barrel Saunas card | **UNVERIFIED** — provenance not documented; treat as BLOCKED until licensed |
| `images/collections/indoor.jpg` | Indoor Saunas card | **UNVERIFIED** — provenance not documented; also low-resolution (540×360) |

`scripts/prelaunch-check.mjs` fails the board while any watermarked file is
still referenced, so this cannot be published by accident.

**All four category cards remain unlicensed.** Removing the watermark fixed the
part that was visible to customers; it did not change the permission position on
any of them. The blocker clears only when the supplier permission emails
(`docs/supplier-permission-wording.md`) come back in writing.
