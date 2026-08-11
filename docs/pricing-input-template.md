# BUXENA — Launch Pricing Input Template

**INTERNAL ONLY. Never expose landed costs, margins or this file's
contents publicly.** Fill each model's block; a spreadsheet version of the
same template is at `docs/pricing-input-template.csv`.

Legend for every value in this file:
- `[MISSING]` — no source exists anywhere in the repo or documentation
- `[ASSUMPTION]` — a working figure someone chose; must be replaced or
  confirmed before approval
- `[DOCUMENTED]` — traceable to a committed source (the source is named)
- `[SUPPLIER-CONFIRMED]` — written supplier confirmation on file

**Current state in one line: every field for every model is `[MISSING]`
except the accessories cost, which is `[DOCUMENTED]` at ~€94/unit** (the
Ritual Kit landed figure from the supplier accessory pricelist, commit
`478486b`). Whether that kit is included, upsold or package-only is
itself an open commercial decision — see the Ritual Kit note in
`src/components/RitualKit.astro`.

Calculated fields (marked ƒ) derive automatically once their inputs
exist — do not fill them by hand in the CSV; the formulas are stated so
the founder can sanity-check them.

---

## Shared inputs (decide once, apply to every model)

| Field | Value | Status |
|---|---|---|
| FX rate EUR→USD | — | [MISSING] — set with revision policy (e.g. quarterly) |
| Duty/tariff % | — | [MISSING] — confirm HS classification for prefabricated wooden sauna cabins with the customs broker; do not assume |
| Ocean freight per container (USD) | — | [MISSING] |
| Freight allocation rule (per unit in mixed container) | — | [MISSING] — by volume share is the usual method |
| Port/handling per container (USD) | — | [MISSING] |
| Inland trucking per container (USD) | — | [MISSING] |
| Delivery policy (allowance in price vs. quoted by ZIP) | — | [MISSING] — decision, not a number |
| Target gross margin % | — | [MISSING] |
| Target markup % | — | [MISSING] — pick margin OR markup as the driver; the other is derived |
| Tax display treatment | — | [MISSING] — ex-tax display is the US norm; confirm |

---

## Model blocks

### ELLA H2 (indoor oval, 1–2 person) — supplier: first supplier (ELLA/ILLI/ALLA/EDA line)

| Field | Value | Status |
|---|---|---|
| Supplier EXW (EUR) | — | [MISSING] — check Admin → Products first; may already be entered in the live database |
| ƒ Converted EXW (USD) | = EXW × FX | awaiting inputs |
| Duty % / ƒ duty amount | shared / = EXW USD × duty% | awaiting inputs |
| Ocean freight allocation | — | [MISSING] — needs crate/volumetric data for this model |
| Port/handling allocation | — | [MISSING] |
| Inland trucking allocation | — | [MISSING] |
| ƒ Sauna landed cost | = EXW USD + duty + freight + port + trucking | awaiting inputs |
| Heater model | — | [MISSING] — **blocking**: verified spec says "Heater compatibility: contact us"; the compatible heater is itself unconfirmed |
| Heater cost | — | [MISSING] |
| Control model / cost | — | [MISSING] — depends on heater choice |
| Stones cost | — | [MISSING] |
| Lighting cost | — | [MISSING] |
| Accessories cost | ~€94/unit (Ritual Kit) | [DOCUMENTED] — commit `478486b`; inclusion policy undecided |
| ƒ Package landed cost | = sauna landed + heater + controls + stones + lighting + accessories | awaiting inputs |
| Delivery policy | shared | awaiting decision |
| Target GM% / markup% | shared | awaiting decision |
| ƒ Calculated retail sauna price | = sauna landed ÷ (1 − GM%) | awaiting inputs |
| ƒ Calculated BUXENA Complete price | = package landed ÷ (1 − GM%) | awaiting inputs |
| **Approved public "From" price** | — | [MISSING] — founder sign-off required |
| Approval status | NOT STARTED | — |
| Notes | Indoor model — delivery/access typically simpler than outdoor freight | — |

### ILLI H2 (indoor oval) — supplier: first supplier

Identical field set to ELLA H2; identical status: **every field
`[MISSING]` except accessories** (same [DOCUMENTED] ~€94). Same blocking
item: heater compatibility unconfirmed in the verified specs.

| Field | Value | Status |
|---|---|---|
| Supplier EXW (EUR) | — | [MISSING] |
| Heater model / cost | — | [MISSING] — same "contact us" block as ELLA H2 |
| …all remaining fields | — | [MISSING] / awaiting shared inputs |
| Approved public "From" price | — | [MISSING] |
| Approval status | NOT STARTED | — |

### EDA Nordic Spruce 2.5m (outdoor barrel, 4–6 person) — supplier: first supplier

| Field | Value | Status |
|---|---|---|
| Supplier EXW (EUR) | — | [MISSING] |
| Ocean freight / port / trucking allocations | — | [MISSING] — needs crate/volumetric data |
| Heater model | — | [MISSING] — spec says "sold separately — wood-fired or electric compatible"; **decide the default package heater** (and whether wood vs. electric are separate Complete variants) |
| Heater / control / stones / lighting costs | — | [MISSING] |
| Accessories cost | ~€94/unit (Ritual Kit) | [DOCUMENTED] |
| Approved public "From" price | — | [MISSING] |
| Approval status | NOT STARTED | — |
| Notes | Outdoor barrel — freight volume larger than the indoor ovals; two heater-type package variants possible | — |

### UKU 160 — glass front / wood back · UKU 160 — half-moon back

| Field | Value | Status |
|---|---|---|
| **Everything** | — | [MISSING] — **these models do not exist in the repository at all**: no supplier identified, no specs, no images, no product pages. They cannot be priced OR listed until supplier documentation arrives. Named as launch candidates in the original brief only. |
| Approval status | BLOCKED — NO PRODUCT DATA | — |

### UKU 230 — glass front / wood back · UKU 230 — half-moon back

Same as UKU 160: `BLOCKED — NO PRODUCT DATA`. No field can be filled.

---

## Website mapping — where an approved "From" price appears automatically

When a founder-approved number is set in a model's frontmatter
(`src/content/saunas/<slug>.md`):

```yaml
fromPrice: "From $18,900"
completeFromPrice: "Complete packages from $23,400"
projectPricing: true
```

…it displays, with **zero further code changes**, in:

1. **Homepage featured cards** — `fromPrice` renders on the card
   (`ProductCard.astro`, `.pcard__price` line under the tagline).
2. **Category/collection cards** — same ProductCard everywhere: /saunas/,
   outdoor-, cube-, barrel-, indoor-saunas, /collections/*.
3. **Product page, above the fold** — the pricing block under the
   availability badge: "Sauna — {fromPrice}", "BUXENA Complete —
   {completeFromPrice}", "BUXENA Project — Project Pricing".
4. **Comparison** (`/compare/`) — the Price row shows each model's
   `fromPrice`; absent values render as "Request pricing".
5. **BUXENA Complete package UI** — `packages.ts` has a per-package
   `fromPrice` field for the homepage/product package tiers ("Sauna from
   $X" etc.); set those when package-level numbers are approved.
6. **Quote/project flow** — prices don't change the form, but the model
   context (with its now-visible price anchoring expectations) carries
   through `?model=` prefill and the package interest through
   `?package=`, so the sales conversation starts anchored.

Until a value is set, every surface shows Request Pricing — no blanks, no
invented numbers.

---

## Exact next values the founder must provide (in order)

1. Supplier EXW EUR for ELLA H2, ILLI H2, EDA Nordic Spruce 2.5m (or
   confirm they're already in Admin → Products).
2. The shared table: FX rate, duty % (broker-confirmed), container
   freight + allocation rule, port/handling, inland trucking.
3. Heater decision + cost for each model (ELLA/ILLI: which heater is
   compatible at all; EDA: which is the package default).
4. Controls/stones/lighting costs for those heaters.
5. Margin or markup target + delivery policy + tax display decision.
6. Ritual Kit inclusion policy (include/upsell/package-only).
7. Sign-off on the three "From" prices → I set three frontmatter lines
   and prices are live site-wide.
8. UKU 160/230: supplier documentation before anything at all.

*Created 2026-08-10. Companion spreadsheet: `docs/pricing-input-template.csv`.*
