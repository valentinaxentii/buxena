# BUXENA V2 — Complete Pricing Audit

Audit date: 2026-08-11 · Read-only audit — no prices, approvals, website
content, database values, or code were changed. Sources: all 35 model
content files, all public pages/components, `src/data/packages.ts`,
`supabase/pricing-schema.sql`, the live admin `products` +
`product_pricing` tables (read-only queries), and the Admin → Pricing
page code.

**No number in this file is approved for publication.** Founder approval
is required before any price appears on the public site.

---

## The headline

**The public website currently displays no price on any model.** All 35
models show "Request Pricing" / "Pricing & availability on request"
everywhere (cards, product pages, sticky bar, compare table, packages).
No placeholder or fake price exists anywhere — this was deliberate.
Currency is USD by design across the system.

Internally, there are **8 pricing worksheets in Admin → Pricing, all
still in Draft status, none approved.** Only 4 of them have real
supplier cost data.

---

## Table A — The 8 models with internal pricing data

All amounts USD unless marked €. "Landed" = cost to get the sauna to the
US warehouse. "Complete landed" adds a $750 heater assumption.

| Model | Category | Public price | Old admin cost / sell price¹ | Supplier EXW | Landed cost | Complete landed | Price source | Recommended retail² | Margin at that price |
|---|---|---|---|---|---|---|---|---|---|
| AAPO³ | (not on website) | — | none | €4,130 ✓ | $5,716 | $6,466 | Supplier workbook, verified | **$11,900** (workbook hypothesis) | 46% |
| ELLA H2 | Indoor | none | $3,400 / $5,100 ⚠️ | €1,610 ✓ | $2,383 | $3,133 | Supplier workbook, verified | **From $4,800** sauna · ~$6,300 complete | 50% |
| UKU 160 | Cube | none | none | €1,930 ✓ | $2,807 | $3,557 | Workbook + Capra US sheet | **From $5,600** sauna · ~$7,100 complete | 50% |
| UKU 230 | Cube | none | none | €2,240 ✓ | $3,217 | $3,967 | Workbook + Capra US sheet | **From $6,400** sauna · ~$7,900 complete | 50% |
| ELLA H1 | Indoor | none | $3,200 / $4,800 ⚠️ | missing | — | — | Old admin entry, unverified | cannot recommend — no EXW | — |
| ALLA H1 | Indoor | none | $4,400 / $6,600 ⚠️ | missing | — | — | Old admin entry, unverified | cannot recommend — no EXW | — |
| EDA Nordic Spruce 2.5m | Barrel | none | $5,200 / $7,900 ⚠️ | missing⁴ | — | — | Old admin entry, unverified | cannot recommend — no EXW | — |
| AURA Thermowood 1.3m | Barrel | none | $2,800 / $4,300 ⚠️ | missing | — | — | Old admin entry, **supplier itself unverified** | do not sell until supplier confirmed | — |

¹ ⚠️ = numbers that were in the admin before this project, with no
documented origin. Treat as unverified.
² At a 50% target gross margin on landed cost, rounded to
retail-friendly numbers. **These hinge on unconfirmed assumptions — see
"What is uncertain" below.**
³ AAPO is a verified real Capra model in the master workbook but has
**no page on the V2 website** — decide whether to add it.
⁴ Workbook has the smaller EDA sizes (160 = €1,570, 200 = €1,870) but
not the 2.5m — ask Capra.

### Worksheet detail (all status = Draft, source = Buxena_Supplier_Landed_Cost_Master.xlsx, compiled 28 Jul 2026)

| Model | EXW € | FX | EXW $ | Duty 15% | Freight | Port | Sauna landed | Heater asm. | Complete landed |
|---|---|---|---|---|---|---|---|---|---|
| AAPO | 4,130 | 1.15 | 4,749.50 | included | 150 | 104.17 | 5,716.10 | 750 | 6,466.10 |
| ELLA H2 | 1,610 | 1.15 | 1,851.50 | included | 150 | 104.17 | 2,383.40 | 750 | 3,133.40 |
| UKU 160 | 1,930 | 1.15 | 2,219.50 | included | 150 | 104.17 | 2,806.60 | 750 | 3,556.60 |
| UKU 230 | 2,240 | 1.15 | 2,576.00 | included | 150 | 104.17 | 3,216.57 | 750 | 3,966.57 |

Supplier variant notes from the worksheets: AAPO thermo-alder bench
alternative EXW €4,360 · UKU 160 thermo-alder bench upgrade €2,180 ·
UKU 230 alternative €2,570; UKU 230 HALF-MOON is a separate supplier
SKU at €2,590.

---

## Table B — The other 27 website models: no pricing data at all

No admin product row, no worksheet, no cost, no price — nothing exists
for:

- **Indoor:** ALLA H2, ILLI H1, ILLI H2
- **Barrels:** EDA Nordic Spruce 1.6 / 2.0 / 2.35 / 2.8 / 3.0 / 3.3 /
  4.0m; EDA Thermowood 1.3 / 1.6 / 2.35 / 2.5 / 2.8 / 3.0 / 3.3 / 4.0m;
  ITI Thermowood 2.3m; VIRU Thermowood 2.4 / 3.0 / 3.6 / 4.0m; VIRU
  Vertical 2.6m; VIRU Panorama 5.0m; VIRU Grand 6.0m
- **Cubes:** NORD Cube 200, NORD Cube 240

Notably **ILLI H2 is a homepage featured model with zero cost data** —
the master workbook may cover it; it was simply never loaded into a
worksheet.

---

## What's included at the price (uniform answer for all models)

Because no public price exists, nothing is publicly promised as
included. Inside the draft worksheets:

- **Heater:** excluded from the sauna price. "Complete" adds a $750 UL
  heater *assumption* — no actual heater model has been chosen or
  priced.
- **Lighting, controls, stones:** excluded, and their costs are blank in
  every worksheet, so "Complete" landed cost is **understated**.
- **Delivery to customer:** excluded everywhere. Landed cost ends at the
  warehouse; there is no last-mile delivery allowance in any number
  above.
- **Installation:** excluded everywhere; the site treats it as
  project-scoped via the quote flow.

---

## What is uncertain (applies to every recommendation above)

1. **Duty 15%** — assumption; the customs broker must confirm the HS
   classification.
2. **FX 1.15 EUR→USD** — assumption; verify at order time.
3. **Freight $150 + port $104 per unit** — assumes a *full 40'
   container of 24 kits*. First, smaller orders will cost meaningfully
   more per unit; margins on early sales will be thinner than the table
   shows.
4. **ELLA H2 conflict:** old admin cost $3,400 vs. documented landed
   $2,383 — and its worksheet flags a **spec mismatch on the public
   page** (site dimensions match no catalog variant) that should be
   corrected before selling it.
5. **UKU 230 half-moon** is a separate supplier SKU at €2,590 — decide:
   option surcharge or its own price.
6. ELLA H1 / ALLA H1 / EDA 2.5m EXW prices and the AURA supplier are
   open questions in the drafted Capra email.

---

## What "Admin → Pricing" approval actually changes on the public website

**Nothing — automatically.** This is by design:

1. Setting a worksheet to **Approved** with an "Approved Public From
   price" only records that number internally (with full history
   snapshots) and shows the resulting gross profit/margin. The public
   site never reads the `product_pricing` tables.
2. A price appears publicly only when, **after** approval, the number is
   written into that model's content file (`fromPrice` /
   `completeFromPrice` frontmatter). The moment that's set, the model's
   card, product page, packages and compare table all display it
   automatically.
3. **Known gap:** the admin quote builder auto-fills from the *old*
   `products.selling_price` field, which Pricing approval does **not**
   update. Until synced, staff quotes could use stale numbers (e.g.
   ELLA H2 quoting at $5,100 while $4,800 is approved). Sync that field
   as part of the approval step.

---

## Suggested approval order

1. **UKU 160 and UKU 230** first — cleanest, fully sourced data (decide
   the half-moon question at the same time).
2. **ELLA H2** after resolving the public-page spec mismatch.
3. Ask Capra for **ILLI H2** EXW so the whole homepage featured row can
   carry prices.
4. Chase remaining EXW gaps (ELLA H1, ALLA H1, EDA 2.5m) and verify the
   AURA supplier before those models get prices.
