# Capra — Dealer Pricing & First Container Request (FINAL)

Finalised 2026-08-11 for founder review. **Not sent.**

**To:** Andres Sokk — andres.sokk@capra.ee — +372 5618 5580
**Manufacturer:** Capra · Estonia
**Covers:** 24 BUXENA models — ELLA ×2, ILLI ×2, ALLA ×2, UKU ×2, 16 EDA barrels
**Why first:** unlocks dealer EXW for 21 models currently missing it, the
image-permission answer blocking 48 assets in `docs/image-rights-register.md`,
and — via §14 — the configuration data that currently keeps the configurator
switched off on 16 of our 32 sellable models (every EDA barrel).

**Already verified for EDA — deliberately NOT re-asked in §14:** the 16 models
and their capacities, length and height per model, roof (bitumen shingle),
and the standard door (tempered glass, brown-tinted). §1 still asks Capra to
confirm the range and each model's correct designation, because our size list
is marked "exact sizes unconfirmed" in
`docs/master-supplier-product-status.md`.

**Deliberate exclusions** (do not reintroduce): no "startup" framing, no
competitor research, no intended retail markup, no internal BUH- codes.

---

**Subject:** BUXENA — dealer pricing and first 40HC container planning

---

Dear Andres,

BUXENA is preparing its U.S. launch and planning a first 40HC container order
for **fall 2026**, shipping to the **Port of New York/New Jersey, USA**. To
finalise our pricing and loading plan, we need the following.

**1 · Models you manufacture**
Please confirm exactly which models Capra manufactures, and send your current
model list. We are working with the ELLA, ILLI, ALLA, UKU and EDA lines, and
would like your confirmation of the full range and of each model's correct
designation.

**2 · Dealer / distributor pricing**
Your current dealer EXW price list covering every model and configuration,
including timber options, as pricing appears to vary by both.

**3 · Minimum order quantity**
Your MOQ — per model, per order, and for a first container.

**4 · Dealer discount structure**
Terms for a first container, recurring container orders and annual volume.

**5 · Payment terms**
Deposit requirement, balance terms, accepted payment methods, and any terms
available to an established dealer.

**6 · Heater and options pricing**
Recommended heater per model with dealer pricing for heater, controls, stones,
lighting and heater guard where applicable. Please confirm whether heaters you
supply are **UL-listed for the U.S. market**, or whether we should source
certified heaters locally.

**7 · Packing and container loading**
Crated dimensions and gross weight for every model; units of each model per
40HC; whether models can be combined in a mixed container, the most efficient
combinations, and approximate total units in a mixed 40HC.

**8 · EXW scope**
Exactly what your EXW price includes — export packing, crating, loading at the
factory, export documentation — and any other origin charges we should expect.

**9 · Lead times**
Current production lead times by model or product family.

**10 · Warranty**
Warranty terms per product, and how warranty claims are handled through a
dealer, including parts and replacements.

**11 · Spare parts**
Availability and dealer pricing for commonly required parts (glass, doors,
benches, hardware, heater components).

**12 · U.S. territory**
Please confirm whether any U.S. territorial restrictions or existing exclusive
distribution arrangements apply to any of the models above.

**13 · Marketing and technical materials**
Please confirm **in writing** whether BUXENA may use your product photography,
technical drawings, dimensional data, manuals and installation documents on
our U.S. website, in printed brochures, in **advertising**, and in customer
proposals. Where available, please also send the files themselves — dimension
drawings, floor plans, installation manuals, electrical guides, foundation
requirements, heater manuals and warranty documents.

**14 · Configurable options — the EDA barrel line**
Our website lets a customer specify their sauna before requesting a quote. For
the EDA line we currently show no options, because we will not list a choice we
cannot confirm. Please complete the table below for **each EDA model** (or tell
us the answer is identical across the line, which is just as useful):

| | What we need |
|---|---|
| Timber | Which sizes are available in Nordic spruce, and which in thermowood — is every length offered in both? |
| Supply format | Is each model offered as a flat-pack kit, factory-assembled, or both? |
| Heaters — electric | The specific electric heaters approved for each model, with the correct kW for that cabin volume |
| Heaters — wood | The specific wood-burning heaters approved for each model, and the flue/chimney kit required |
| Controllers | Which control units pair with each heater, and which are built-in versus separate |
| Glass and front | Options beyond the standard brown-tinted glass door — panoramic front, full-glass, clear or bronze glazing |
| Door | Hinge side, whether it is reversible, and whether the door can be specified left or right |
| Roof | Options beyond bitumen shingle |
| Benches and layout | Bench material options, and any layout variants (e.g. with or without a changing room) |
| Included as standard | Exactly what the base price includes — benches, door, roof, hardware, stones, chimney, lighting |
| Optional upgrades | Everything orderable as an extra, with dealer pricing per item |
| Electrical | Supply requirement per model and heater — kW, phase, and recommended breaker |
| Accessories | Your accessory range with dealer pricing |

Two clarifications that matter most, if the table is too much detail to send at
once: **which heaters are approved for which EDA model**, and **what the base
price includes**. Those two answers alone let us present the EDA line properly.

Once we have this information we can confirm model selection, container
composition and order timing.

With respect,

**Valentin Axentii**
BUXENA — Where Wellness Starts
info@buxena.com | buxena.com

---

## When the reply arrives

1. Enter dealer EXW per model into Admin → Pricing worksheets.
2. Update `docs/master-supplier-product-status.md` and
   `BUXENA_V2_PRICING_STRATEGY.md` §2 and §4 — crate dimensions finally allow
   freight allocation by volume instead of the flat $150/unit average.
3. Record written image/document permission in `docs/image-rights-register.md`.
4. Only then does a price become a candidate for `src/data/pricing.ts`, and
   only with founder approval.
