# BUXENA V2 — Pricing & Technical-Document Readiness

Internal worksheet. **Nothing here is customer-facing, and no number may be
published without explicit founder approval.**

## 1. Pricing architecture

The public architecture is complete: model frontmatter supports `fromPrice`,
`completeFromPrice`, `projectPricing`, `deliveryEstimate` and `availability`.
Cards, product pages, packages and compare surfaces can display approved values,
and fall back to Request Pricing when those values are absent.

The public pricing register remains intentionally empty until founder-approved
retail numbers exist.

## 2. Correction to the older “zero pricing inputs” status

The earlier version of this document said no pricing inputs existed. That is no
longer the correct project record. Original BUXENA source workbooks recovered in
Google Drive contain historical planning inputs and landed-cost models, including:

- `Buxena Sauna Order Landed Cost.xlsx` (prepared 2026-07-24).
- `Buxena UKU160 Installed Unit Economics.xlsx`.
- `Copy of WoodArchitects_Landed_Cost_Analysis`.
- Capra landed-cost / first-order analysis in the migration package.

These sources are **planning models, not automatic approval to publish or order**.
Some cells explicitly say they are estimates/placeholders and must be replaced by
supplier quotes before purchasing.

Examples of recovered planning inputs:

- The opening-order workbook includes estimated EXW planning values for ELLA H2,
  ILLI H2 and UKU 160, while explicitly stating that no supplier price list was
  provided for that model and that the estimates must be replaced before a
  purchase decision.
- The UKU 160 unit-economics workbook models EUR→USD, container freight, kits per
  40HC, landed kit cost, heater, local delivery and assembly; multiple inputs are
  marked for verification.
- The Capra first-container analysis contains a separate 20-unit planning model
  based on the historical supplier discussions and should be reconciled against
  the latest written supplier quote/PI before use.

Therefore the correct classification is:

**PRICING MODEL EXISTS — CURRENT SUPPLIER / LOGISTICS INPUTS STILL NEED
VERIFICATION.**

Do not treat estimated workbook values as supplier-confirmed EXW.

## 3. What is still required before public pricing

### Shared commercial inputs

- [ ] Current supplier EXW / dealer price for each launch model.
- [ ] Written confirmation of currency and payment terms.
- [ ] Current EUR→USD assumption and revision policy.
- [ ] Customs-broker-confirmed HS classification and duty/tariff treatment.
- [ ] Current ocean freight quote and allocation methodology.
- [ ] Port/terminal/broker/inland trucking costs.
- [ ] Warehouse handling/storage allowance.
- [ ] Heater, controls, stones, lighting and accessory costs for the default
      Complete package.
- [ ] Delivery/install allowance policy by ZIP/project.
- [ ] Warranty/repair/contingency allowance.
- [ ] CAC / sales commission allowance used for profitability decisions.
- [ ] Founder-approved target gross margin and minimum deal margin.

### Featured model priorities

Start with the smallest set of high-intent launch models rather than pricing the
entire catalogue at once:

1. ELLA H2.
2. ILLI H2.
3. One high-confidence outdoor model with verified supplier rights/specs/costs.

For each: current EXW + packed dimensions/weight + default compliant heater
package + landed allocation + approved retail price are required before setting
`fromPrice` or `completeFromPrice`.

## 4. Internal pricing source of truth

Use the existing BUXENA admin/Supabase commercial structure as the operational
source of truth once current figures are verified. It already has product/supplier
cost fields and order landed-cost / gross-profit / margin architecture.

Do **not** build a second parallel pricing system in the website content.

Flow:

supplier quote/PI → verified internal cost inputs → landed-cost calculation →
founder margin approval → approved retail number → public frontmatter value.

The website should never reverse this flow by inventing a retail price first.

## 5. Public pricing governance

No public price should be inserted unless the supporting economics are current and
approved. The prelaunch audit is designed to keep the site price-free while the
approval register is empty.

Use `BUXENA Recommended`, not Best Seller / Most Popular, until actual sales data
supports those claims.

## 6. Technical-document readiness

The website architecture for downloads is ready, but technical documents must be
matched to the exact model and rights/usage terms before publication.

Priority documents per launch model:

- supplier specification sheet;
- assembly / installation manual;
- foundation/base requirements;
- electrical requirements;
- heater/control manuals for the actual U.S.-compliant package;
- written warranty terms;
- packing dimensions / weight;
- drawings where genuinely supplied.

Do not claim CAD/BIM/Revit availability until those files actually exist.

## 7. External source material now available

The migrated/connected sources also contain competitor technical packages and
warranties (for example SaunaLife/HUUM materials received during competitor
research). Those are useful for competitive analysis and buyer-experience design,
but they are **not BUXENA supplier documentation** and must not be republished as
BUXENA product documentation.

## 8. Current decision

The website does not need another pricing architecture rebuild. The commercial
bottleneck is obtaining and reconciling **current, written supplier and logistics
inputs** against the existing landed-cost models.

*Updated 2026-08-12.*
