# BUXENA V2 — Pricing & Technical-Document Readiness

Internal worksheet. **Nothing in this file is customer-facing, and no
number here may be published without explicit founder approval.**

## 1. Pricing readiness — launch models

The public architecture is DONE and waiting: `fromPrice`,
`completeFromPrice`, `projectPricing`, `deliveryEstimate`, `availability`
fields exist on every model (`src/content.config.ts`); cards, product
pages, package tiers and the compare table all render prices the moment a
value is set, and show Request Pricing when absent.

**Classification — every model in the catalog is currently:
`PRICE MISSING INPUTS`.** No pricing data of any kind exists in this
repository (the admin/Supabase `products` table has EXW/selling-price
columns, but no `.env` exists locally to read live data, and no exported
price list is committed). Nothing is even at "needs approval" stage yet.

### Missing inputs per model (identical for all launch candidates today)

| Input | ELLA H2 | ILLI H2 | EDA barrels | VIRU barrels | NORD cubes |
|---|---|---|---|---|---|
| Supplier EXW | ❌ | ❌ | ❌ | ❌ | ❌ (supplier wholesale pricelist referenced in commit history but not committed) |
| FX assumption (EUR→USD) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Duty / tariff rate | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ocean freight allocation | ❌ | ❌ | ❌ | ❌ | ❌ |
| Port + inland trucking | ❌ | ❌ | ❌ | ❌ | ❌ |
| Heater cost | ❌ | ❌ | ❌ | ❌ | ❌ (HUUM 9kW standard per catalog — cost unknown) |
| Controls cost | ❌ | ❌ | ❌ | ❌ | ❌ |
| Stones cost | ❌ | ❌ | ❌ | ❌ | ❌ |
| Lighting cost | ❌ | ❌ | ❌ | ❌ | ❌ |
| Accessories (Ritual Kit ~€94/unit is the ONLY committed cost datum, commit `478486b`) | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Delivery allowance model | ❌ | ❌ | ❌ | ❌ | ❌ |
| Target gross margin | ❌ | ❌ | ❌ | ❌ | ❌ |
| Consumer markup policy | ❌ | ❌ | ❌ | ❌ | ❌ |
| Sales-tax treatment | ❌ | ❌ | ❌ | ❌ | ❌ |

### Internal pricing data structure (ready to fill)

The admin already stores per-product `EXW/cost`, `selling price`, and full
landed-cost fields (`orders`: freight, customs, port, inland, warehouse,
installation, other → generated `landed_cost` / `gross_profit` /
`gross_margin_pct`). **Use that existing system as the single source of
internal pricing truth** — do not build a second one. Public display
prices are then set per model in content frontmatter after approval:

```yaml
fromPrice: "From $18,900"          # sauna alone — approved retail
completeFromPrice: "Complete packages from $23,400"
projectPricing: true               # shows "Project Pricing"
```

**Path to first public prices:** supplier EXW pricelists → landed-cost
worksheet in admin → founder-approved retail per launch model → one
frontmatter line each. Recommend starting with the 3 featured models
(ELLA H2, ILLI H2, EDA Nordic Spruce 2.5m).

---

## FEATURED-MODEL PRICING WORKSHEET (fill and approve — 2026-08-10)

The three homepage featured models, audited individually. Repo/local
status: **zero pricing inputs available** — no price appears in any
committed file for any of the three, and with no local `.env` the live
admin `products` table (which has EXW/selling-price columns) cannot be
read from here. If EXW values were already entered in the live admin,
half of this worksheet may already be done — check Admin → Products
first.

Shared inputs (decide once, apply to all models):
- [ ] EUR→USD FX assumption + revision policy (e.g. quarterly)
- [ ] Duty/tariff rate for prefabricated wooden sauna cabins (confirm the
      HS classification with the customs broker — do not assume)
- [ ] Ocean freight per container + how it allocates across units in a
      mixed load
- [ ] Port handling + inland trucking to warehouse
- [ ] Delivery allowance policy (flat allowance in price vs. quoted by ZIP)
- [ ] Target gross margin / consumer markup policy
- [ ] Sales-tax display treatment (price ex-tax is the US norm — confirm)

Per-model inputs:

**ELLA H2 (indoor, 1–2 person)** — `PRICE MISSING INPUTS`
- [ ] Supplier EXW for the H2 configuration
- [ ] Compatible heater model + cost (spec sheet says "contact us" — the
      heater choice itself is unconfirmed, blocking Complete pricing)
- [ ] Controls, stones, lighting costs for that heater
- [ ] Crate/volumetric shipping data (affects freight allocation)

**ILLI H2 (indoor)** — `PRICE MISSING INPUTS`
- [ ] Same list as ELLA H2 (same supplier line, same unknowns)

**EDA Nordic Spruce 2.5m (outdoor barrel, 4–6 person)** — `PRICE MISSING INPUTS`
- [ ] Supplier EXW for the 2.5m Nordic Spruce configuration
- [ ] Heater options + costs (frontmatter: "sold separately — compatible
      with wood-fired or electric" — need at least one priced default for
      a Complete package)
- [ ] Wood-fired vs electric package variants decision
- [ ] Crate/volumetric shipping data

Approval flow once inputs exist: enter costs in Admin (landed-cost
fields) → founder signs off a retail "From" number per model → set
`fromPrice` / `completeFromPrice` in that model's frontmatter → the card,
product page, packages and compare table display it automatically.

## 2. Technical-document matrix — launch products

Full-repository audit (public/, src/, data/): **zero technical documents
of any kind exist** — no PDFs, no manuals, no drawings, no brochures.
Every cell below is therefore MISSING or NEEDS SUPPLIER; nothing was
invented, and every product page shows the polished "Technical documents
are being prepared" fallback with the Request Specifications CTA
(tracked). The `downloads:` frontmatter auto-links real files per model
the moment they're added.

| Document | ELLA/ILLI/ALLA | EDA/AURA/ITI | VIRU | NORD |
|---|---|---|---|---|
| Spec sheet | NEEDS SUPPLIER | NEEDS SUPPLIER | NEEDS SUPPLIER | NEEDS SUPPLIER (2026 collection catalog exists at supplier) |
| Installation manual | NEEDS SUPPLIER | NEEDS SUPPLIER | NEEDS SUPPLIER | NEEDS SUPPLIER |
| Assembly instructions | NEEDS SUPPLIER | NEEDS SUPPLIER (flat-pack kits exist) | NEEDS SUPPLIER (flat-pack option) | NEEDS SUPPLIER (flat-pack option) |
| Foundation / base requirements | MISSING | MISSING | MISSING | NEEDS SUPPLIER (steel base documented in specs) |
| Electrical requirements | NEEDS SUPPLIER | n/a for wood-fired configs | NEEDS SUPPLIER per heater | NEEDS SUPPLIER (single/three-phase noted) |
| Heater manual | NEEDS SUPPLIER (heater TBD per model) | NEEDS SUPPLIER | NEEDS SUPPLIER (Harvia/HUUM/Cozy/Narvi listed) | NEEDS SUPPLIER (HUUM 9kW standard) |
| Control manual | NEEDS SUPPLIER | NEEDS SUPPLIER | NEEDS SUPPLIER (HUUM app control listed) | NEEDS SUPPLIER (HUUM Wi-Fi listed) |
| Warranty document | NEEDS SUPPLIER — no real warranty terms exist anywhere (PDF quote uses placeholder boilerplate, flagged in HANDOFF) | same | same | same |
| Drawings | MISSING — never claim CAD/BIM/Revit until files exist | MISSING | MISSING | MISSING |

**Single highest-leverage ask to suppliers:** spec sheet + installation
manual + warranty terms per launch model. That fills Downloads, the trade
"Request Specifications" fulfilment, and the PDF quote's warranty
placeholder in one request.

*Last updated 2026-08-10.*
