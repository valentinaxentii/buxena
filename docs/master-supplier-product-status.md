# BUXENA — Master Supplier & Product Status

Authoritative status of every model in the catalogue. Established 2026-08-11.
Update this file whenever a supplier confirms a model, a dealer price arrives,
or a territory/permission question is answered.

**Legend:** ✅ verified · ⚠️ partial or assumed · ❌ unknown or missing

---

## Suppliers on file

| Supplier | Country | Contact | U.S. distribution | Notes |
|---|---|---|---|---|
| **CAPRA** | Estonia | Andres Sokk — andres.sokk@capra.ee — +372 5618 5580 | No arrangement found | 24 models — the largest block |
| **WOOD ARCHITECTS** | Lithuania | Pijus Kazlauskas — pijus@woodarchitects.eu | **Appears open** — their distributor page names European exclusives only, no USA/North America mention | 4 models; premium cost level |
| **BALTRESTO** | Estonia | Anton Kostusjov, Sales Director — sales.manager@baltresto.com | ⚠️ **BSaunas USA (Lockport, NY) distributes the full barrel line.** No exclusivity claimed on their public pages, but a private arrangement may exist | 4 models; the cost-competitive supplier |
| *TESLER* | Estonia | none on file | unknown | In the master workbook only; nothing in our catalogue maps to them |

---

## Model status — all 35

| # | BUXENA model | Code | Manufacturer | Supplier verified | Source match | EXW cost | U.S. territory | Image/doc permission |
|---|---|---|---|---|---|---|---|---|
| 1 | ELLA | BUH-01 | CAPRA | ✅ | ✅ | ✅ €1,610 | ❌ | ❌ |
| 2 | ELLA II | BUH-02 | CAPRA | ✅ | ✅ | ❌ | ❌ | ❌ |
| 3 | ILLI | BUH-03 | CAPRA | ✅ | ✅ | ❌ | ❌ | ❌ |
| 4 | ILLI II | BUH-04 | CAPRA | ✅ | ✅ | ❌ | ❌ | ❌ |
| 5 | ALLA | BUH-05 | CAPRA | ✅ | ✅ | ❌ | ❌ | ❌ |
| 6 | ALLA II | BUH-06 | CAPRA | ✅ | ✅ | ❌ | ❌ | ❌ |
| 7 | UKU 160 | BUH-10 | CAPRA | ✅ | ✅ | ✅ €1,930 | ❌ | ⚠️ drive-approved images only |
| 8 | UKU 230 | BUH-11 | CAPRA | ✅ | ✅ | ✅ €2,240 | ❌ | ⚠️ drive-approved images only |
| 9 | NORD Cube 200 | BUH-12 | WOOD ARCHITECTS | ✅ spec-matched | ✅ conclusive | ⚠️ workbook €8,960 | ✅ appears open | ❌ |
| 10 | NORD Cube 240 | BUH-13 | WOOD ARCHITECTS | ✅ spec-matched | ✅ conclusive | ⚠️ workbook €9,810 | ✅ appears open | ❌ |
| 11–26 | **16 × EDA barrels** (Thermowood 1.3/2.35/2.5/2.8/3.0/3.3/4.0m · Thermo-Treated Pine 1.6m · Nordic Spruce 1.6/2.0/2.35/2.5/2.8/3.0/3.3/4.0m) | BUH-20–35 | CAPRA | ✅ | ⚠️ line verified, exact sizes unconfirmed | ❌ all 16 | ❌ | ❌ |
| 27 | VIRU Thermowood 2.4m | BUH-38 | BALTRESTO | ✅ spec-matched | ⚠️ strong (S2V) | ⚠️ workbook | ⚠️ BSaunas USA | ❌ |
| 28 | VIRU Thermowood 3.0m | BUH-39 | WOOD ARCHITECTS | ⚠️ probable | ⚠️ probable (Barrel M 300cm) | ⚠️ workbook €3,654 | ✅ appears open | ❌ |
| 29 | VIRU Thermowood 4.0m | BUH-41 | BALTRESTO | ✅ spec-matched | ⚠️ strong (S4PE/S4PT) | ⚠️ workbook €2,800 | ⚠️ BSaunas USA | ❌ |
| 30 | VIRU Vertical 2.6m | BUH-42 | BALTRESTO | ✅ spec-matched | ✅ conclusive (SHE/SHT) | ⚠️ workbook €1,580 | ⚠️ BSaunas USA | ❌ |
| 31 | VIRU Panorama 5.0m | BUH-43 | BALTRESTO | ✅ spec-matched | ✅ conclusive (S5PLE/T) | ⚠️ workbook €3,790/4,620 | ⚠️ BSaunas USA | ❌ |
| 32 | VIRU Grand 6.0m | BUH-44 | WOOD ARCHITECTS | ✅ spec-matched | ✅ conclusive (Barrel XL 600cm) | ⚠️ workbook €4,957/6,444 | ✅ appears open | ❌ |
| 33 | ITI Thermowood 2.3m | BUH-36 | ❌ NONE | ❌ | ❌ no match in 76 SKUs | ❌ | ❌ | ❌ **HELD** |
| 34 | AURA Thermowood 1.3m | BUH-37 | ❌ NONE | ❌ | ❌ no match; admin says NO SUPPLIER | ❌ | ❌ | ❌ **HELD** |
| 35 | VIRU Thermowood 3.6m | BUH-40 | ❌ NONE | ❌ | ❌ no match | ❌ | ❌ | ❌ **HELD** |

---

## HOLD — supplier verification (hidden from customer-facing sales)

Three models carry `draft: true` plus an internal `hold:` reason in their
content files. They are removed from the catalogue, filters, compare tool,
advisor, sitemap, and their pages are not generated. **Nothing was deleted** —
content, images and generated presentations are all preserved. Restore by
removing `draft` and `hold` once a supplier confirms the model.

| Model | Reason |
|---|---|
| ITI Thermowood 2.3m | 230cm matches no SKU in any of the four supplier ranges; capacity also unverified |
| AURA Thermowood 1.3m | 130cm is smaller than every barrel in all four ranges; admin product record carries NO SUPPLIER |
| VIRU Thermowood 3.6m | 360cm matches neither Baltresto (3m/4m) nor Wood Architects (300/400cm) |

---

## Open integrity issue — the VIRU series spans two manufacturers

Not yet actioned; renaming deferred by founder decision.

- **BALTRESTO:** VIRU Thermowood 2.4m · VIRU Thermowood 4.0m · VIRU Vertical 2.6m · VIRU Panorama 5.0m
- **WOOD ARCHITECTS:** VIRU Thermowood 3.0m · VIRU Grand 6.0m
- **Unidentified:** VIRU Thermowood 3.6m (held)

One series name across two factories will complicate ordering, warranty claims
and spare parts. Recommendation when revisited: keep VIRU for the Baltresto
group and give the Wood Architects pair a separate series name.

---

## Headline gaps

1. **Verified dealer EXW: 3 of 35.** A further 11 have workbook EXW that is
   supplier-list-derived, not dealer-quoted — modelling only, not ordering.
2. **Image/document permission: 0 of 35 confirmed in writing.** The most
   universal gap; blocks paid advertising as well as brochures.
3. **16 EDA barrels** are the largest single block — one Capra reply resolves
   supplier match and cost for nearly half the catalogue.
4. **Territory risk concentrates in the 4 Baltresto models**, which are also
   the most cost-competitive.

*Outreach drafts: `docs/capra-pricing-request.md`,
`docs/wood-architects-pricing-request.md`, `docs/baltresto-pricing-request.md`.*
