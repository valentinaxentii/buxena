# BUXENA V3 — Competitor Pricing Intelligence

Competitor pricing is a private research layer. It is separate from both supplier cost and BUXENA public retail pricing.

## Separation rule

1. **Supplier pricing** = what BUXENA is quoted by manufacturers/suppliers.
2. **Competitor pricing** = what other retailers publicly advertise at a dated source.
3. **BUXENA retail pricing** = only founder-approved customer pricing in the existing public pricing register.

No competitor observation automatically changes a supplier cost, a quote, an order or a public BUXENA price.

## Evidence rule

Every observation retains:

- competitor
- check date
- exact product name
- currency
- observed price
- optional compare-at / sale price
- source URL
- evidence/freshness notes
- optional manual BUXENA product mapping

A mapping is never guessed from a similar model number. Matching is a manual commercial review step.

## Initial BSaunas baseline

Checked 2026-08-29:

- **BSaunas USA** — 15 USD sauna-room/outdoor observations. Direct automated page access returned 403, so the seed explicitly records that these values came from BSaunasUSA source snapshots available through current search indexing and must be rechecked before a pricing decision.
- **Bsaunas Canada** — 16 CAD heater/control/stone observations. The Canadian store was directly readable and also stated that it was currently unable to ship to the United States due to recent tariff changes.

The seed deliberately keeps USD and CAD separate; no hidden FX conversion is applied.

## V3 files

- `supabase/migrations/2026-08-29-competitor-pricing.sql` — private tables/RLS/view; prepared only.
- `src/pages/admin/competitor-pricing/index.astro` — admin-only competitor and price-observation entry/history.
- `private-data/competitor-pricing/bsaunas-2026-08-29.json` — dated evidence baseline.
- `scripts/seed-competitor-prices.mjs` — deliberate seed; never part of build/deploy.
- `tests/competitor-pricing-seed.test.ts` — validates counts, currencies, sources and price integrity.

## Deployment boundary

As with the supplier-price registry, the migration and seed are committed to V3 but are not applied to production by branch work. Applying a database migration remains an explicit release action.
