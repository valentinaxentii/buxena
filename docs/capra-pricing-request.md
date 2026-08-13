# Capra — Dealer Pricing & Image Permission (FINAL, concise)

Revised 2026-08-13 for founder review. **NOT SENT.**

**To:** Andres Sokk — andres.sokk@capra.ee — +372 5618 5580
**Manufacturer:** Capra · Estonia
**Covers:** 24 BUXENA models — ELLA ×2, ILLI ×2, ALLA ×2, UKU ×2, 16 EDA barrels

**Why this is priority #1.** One reply unblocks dealer EXW for the 21 models
that have none, paid-advertising permission across 24 models, photography that
would restore 16 product pages, and the crate dimensions every margin figure
currently assumes.

**Cut from the earlier draft, deliberately:** payment terms, dealer discount
tiers, spare parts, EXW scope breakdown, and the 13-row EDA configuration
table. They were all worth knowing and together they made the email
unanswerable. The EDA heater question — the single most valuable line of that
table — is folded into item 5. The rest is a second email once this one is
answered.

**Permission status going in:** Capra has ALREADY granted, in writing (Gmail),
permission to use shared-drive images on the BUXENA website. Item 8 asks to
*extend* that grant. Do not re-request website permission as though it were
open — that reopens a settled point.

**Check before sending:** "autumn 2026" and the NY/NJ port are carried from the
earlier draft. Change if the plan has moved.

---

**Subject:** BUXENA — dealer price list and image permission

---

Dear Andres,

BUXENA is preparing its U.S. launch and planning a first 40HC container for
**autumn 2026**, shipping to the **Port of New York/New Jersey**. Ten questions,
and a price list would answer several of them at once.

**1 · Dealer price list**
Your current dealer EXW price list, covering every model and timber option.
Please make sure it includes:

- **Indoor:** ELLA and ELLA II · ILLI and ILLI II · ALLA and ALLA II
- **Cube:** UKU 160 and UKU 230, with the **half-moon** as its own line
- **EDA Thermowood:** 1.3 · 1.6 · 2.35 · 2.5 · 2.8 · 3.0 · 3.3 · 4.0m
- **EDA Nordic Spruce:** 1.6 · 2.0 · 2.35 · 2.5 · 2.8 · 3.0 · 3.3 · 4.0m

If a size on that list is not one you make, please say so — knowing a length
does not exist helps us as much as its price.

**2 · Minimum order quantity** — per model, and for a first container.

**3 · Production lead time** — by model or product family.

**4 · Availability** — is production made to order against a confirmed PO, or do
you hold finished stock? If you hold stock, how do we check what is available
when ordering, and how long is it held once reserved?

**5 · Heaters, and what the base price includes**
The recommended heater per model with dealer pricing, and whether the heaters
you supply are **UL-listed for the U.S. market** or should be sourced locally.
Please also state per model **what the base price includes and excludes** —
specifically heater, controls, stones, lighting and chimney/flue. For the EDA
line, which heaters are approved for which length matters most.

**6 · Crate dimensions and gross weight** — for every model. We cannot plan
container loading or freight cost without them.

**7 · Warranty** — terms per product, and how a dealer handles a claim.

**8 · U.S. territory and pricing conditions**
Do any U.S. territorial restrictions or exclusive arrangements apply to these
models? And do you impose any **minimum advertised price (MAP), recommended
retail price (MSRP) or other resale-price condition** on U.S. dealers, or
require approval before we publish a retail price?

**9 · Image permission**
Thank you for the written permission you have already given us to use the
shared-drive images on the BUXENA website. May we extend it, in writing, to
cover use of your product photography and renders:

- on the **BUXENA website** *(already granted — listed for completeness)*
- on **BUXENA social media**
- in **organic marketing** — email, newsletters, brochures
- in **paid advertising** — Google, Meta, Pinterest and similar

and to make ordinary presentational adjustments for those placements —
**cropping, resizing, colour correction**, and placing the BUXENA logo on the
image? We would not alter the product itself, and would only ever use an image
of a model to represent that same model. If anything needs limiting, tell us and
we will follow it exactly.

**10 · EDA photography**
We hold no usable photography for the EDA barrel line — the largest part of our
range and the part we can least present today. If you have product photography
or renders for those models, please send them under the same permission.

Once we have this we can confirm model selection and container composition.

With respect,

**Valentin Axentii**
BUXENA — Where Wellness Starts
info@buxena.com | buxena.com

---

## When the reply arrives

1. Dealer EXW per model → Admin → Pricing worksheets.
2. Crate dimensions → `BUXENA_V2_PRICING_STRATEGY.md` §4; freight can finally be
   allocated by volume instead of the flat $150/unit average.
3. Image permission → `docs/image-rights-register.md`, **split by use**.
4. EDA photography → restore `heroImage.src` in the 16 EDA content files
   (the reason is recorded in each one) and re-run
   `node scripts/catalogue-readiness.mjs`.
5. Any MAP/MSRP condition constrains what may ever be published — record it.
6. Only then does a price become a candidate for `src/data/pricing.ts`, and only
   with founder approval.
