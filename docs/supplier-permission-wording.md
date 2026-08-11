# Supplier Asset Permission — blanket wording

One authorization covering **all** of a manufacturer's models and assets, rather
than asking model by model. Written 2026-08-11. **Not sent.**

**Why blanket:** per-model permission does not scale — 35 models across three
manufacturers, and the set changes whenever a supplier adds or retires a model.
A range-wide grant tied to *"products BUXENA distributes"* stays valid as the
catalogue changes, with no follow-up request needed.

**Why it matters now:** image/document permission is currently **0 of 35 in
writing** and is the single biggest launch blocker — it gates paid advertising,
not just brochures. Point 9 of each supplier email already asks for this; the
wording below is the fuller version to send if a supplier wants something more
formal, or to attach as a short agreement.

---

## A · Short version — paste into an email

> **Marketing and technical asset permission**
>
> Please confirm in writing that BUXENA is authorized to use your product
> photography, renders, technical drawings, dimensional data, specifications,
> manuals and installation documents for **all models BUXENA distributes or
> offers**, across our website, printed and digital brochures, customer
> proposals and quotations, trade and architectural specification documents,
> email communications, and paid and organic advertising and social media, in
> the United States.
>
> We would also like to confirm that BUXENA may:
> — reproduce and resize assets, and place them on BUXENA-branded layouts;
> — remove or replace backgrounds for consistent product presentation;
> — present the products under BUXENA model names and BUXENA model codes.
>
> This permission would apply for the duration of our distribution
> relationship, and to models added to your range during it. We will not
> present your products as manufactured by BUXENA, and we will not alter
> product imagery in any way that misrepresents the product itself.
>
> If any asset carries a restriction — third-party photography, licensed
> imagery, or a model you do not wish shown in the U.S. — please identify it
> and we will exclude it.

---

## B · Formal version — for a short agreement or a supplier's own form

> **Asset licence**
>
> [Manufacturer] grants BUXENA a non-exclusive, royalty-free licence to use
> [Manufacturer]'s product photography, renders, technical drawings,
> dimensional data, specifications, manuals and installation documents
> ("Assets") in connection with the marketing, sale and support of products
> BUXENA purchases from or distributes on behalf of [Manufacturer].
>
> **Scope of use.** Website, brochures, customer proposals and quotations,
> trade and specification documents, email, and paid and organic advertising,
> in the United States.
>
> **Adaptation.** BUXENA may resize, crop, re-background and place Assets
> within BUXENA-branded layouts, and may present products under BUXENA model
> names and codes, provided no adaptation misrepresents the product.
>
> **Term.** For the duration of the distribution relationship, extending
> automatically to models added to [Manufacturer]'s range during that term.
> Either party may withdraw permission for a specific Asset on written notice,
> and BUXENA will cease use of that Asset within 30 days.
>
> **Attribution.** BUXENA will not represent itself as the manufacturer.
> [Manufacturer] retains all ownership in the Assets.
>
> **Exclusions.** [Manufacturer] will identify any Asset it is not entitled to
> sub-licence, including third-party photography.

---

## Two points worth getting right

1. **The exclusions clause protects you, not just them.** Suppliers routinely
   hold imagery they do not own — agency shots, licensed stock, photographer
   work-for-hire. A blanket grant from someone who lacks the underlying rights
   is worth nothing. Asking them to flag exclusions is what makes the grant
   reliable.

2. **"Present under BUXENA model names and codes" is deliberate.** The
   catalogue already uses BUXENA identity (ELLA = BUH-01), and the presentations
   show no supplier reference. That practice should be authorized explicitly
   rather than assumed.

**On receipt:** record the permission, its date and any exclusions in
`docs/image-rights-register.md`, then update `imageRights` in
`src/data/model-identity.json` — models move from WAITING FOR PERMISSION to
READY automatically.
