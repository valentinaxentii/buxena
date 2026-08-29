# BUXENA V3 — Supplier Pricing Registry

This is the private commercial-cost layer for V3. It is separate from the public BUXENA pricing register.

## Rules

- Supplier cost never becomes customer-facing pricing automatically.
- Original supplier workbooks are retained in a **private** Supabase Storage bucket (`supplier-price-lists`).
- Every imported price list becomes a new version. Older versions remain in history.
- New uploads are `Needs Review` and are **not current** until an admin approves them.
- Approval switches only the current pointer for the same supplier + catalog scope. It does not delete the previous list.
- Quote/order values are not rewritten when a supplier price list changes.
- Importers never guess unknown supplier columns. Each supplier workbook format gets an explicit parser adapter.
- `supplier_price_items.product_id` stays null until a BUXENA product mapping is verified.
- Public pricing continues to be controlled by `src/data/pricing.ts`; this registry must never be imported into public components.

## SAWO baseline retained in V3

The two founder-supplied 2026 SAWO workbooks are represented by normalized private seed files:

| Scope | Price-list date | Priced rows | Currency | Terms | Source SHA-256 |
| --- | --- | ---: | --- | --- | --- |
| Accessories | 2026-08-20 | 400 | USD | FCA | `0a02d5fb57d148e2418b87904b1f83f9acfc764baaf2d1f6d8050a01f322bc9a` |
| Sauna Rooms | 2026-08-14 | 240 | USD | FCA | `57d278b66f90907dc806f3de5d85063a33752edbea03cfb45ef435d760365dfb` |

Total: **640 priced source rows**.

The workbook price columns are formatted as USD with two decimal places. The V3 seeds retain the displayed supplier prices to cents and keep source-row identity. The upload importer additionally preserves the original workbook and the imported raw row payload.

## V3 files

- `supabase/migrations/2026-08-29-supplier-price-registry.sql` — additive database/storage/RLS schema.
- `src/lib/supplier-pricing-import.ts` — explicit workbook parser dispatcher; SAWO Accessories and Sauna Rooms are the first adapters.
- `src/pages/admin/supplier-pricing/index.astro` — admin-only upload and version history.
- `src/pages/admin/supplier-pricing/[id].astro` — admin-only line review, comparison, and approval.
- `private-data/supplier-pricing/*.prices.json` — normalized SAWO baseline retained in the private repository.
- `scripts/seed-sawo-price-lists.mjs` — deliberate one-time/current-baseline seeder; never runs during build.
- `tests/supplier-pricing-seed.test.ts` — verifies source counts, hashes and price integrity.

## Deployment boundary

The migration and seed are prepared in `buxena-v3`, but they must not be applied to the production database merely by building or deploying the branch. Database application remains an explicit release action.
