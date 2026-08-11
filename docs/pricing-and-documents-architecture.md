# BUXENA V2 — Pricing & Document Architecture

How approved prices and per-model documents reach the website. Written
2026-08-11, when **nothing is priced and no document exists** — both systems
are built, empty, and waiting on real inputs.

## 1. Pricing — one register, no page edits

**`src/data/pricing.ts` is the single source of truth for every price a
customer can see.** It is currently empty by design: the founders are
collecting U.S. competitor quotes and analysing landed cost before setting
retail (see `BUXENA_V2_PRICING_AUDIT.md`).

Publishing a price is a **one-line change in one file**:

```ts
'BUH-UKU 160': {
  fromPrice: 'From $5,600',
  approvedBy: 'V. Xentii',
  approvedOn: '2026-09-01',
  note: 'Sauna only. Heater, delivery and installation quoted separately.',
},
```

That single entry appears automatically and consistently on:

| Surface | Behaviour with no approved price |
|---|---|
| Product page hero | No price block; Request Pricing CTA carries the page |
| Product cards (homepage, catalog, category, related) | No price line |
| Compare table | "Request pricing" in the price row |
| Sticky sales bar | "Pricing & availability on request" |

Removing the entry reverts every surface just as cleanly. Keys are the exact
internal titles (`BUH-…`), so a typo yields no price rather than mis-pricing a
different model.

**Never permitted in this file:** supplier EXW, landed cost, margin targets,
workbook hypotheses, competitor numbers, estimates, placeholders, test values.
Only founder-approved retail figures, each with `approvedBy` + `approvedOn`
for the audit trail.

**Automated guard:** `scripts/prelaunch-check.mjs` scans every built page for
price-like values and fails the launch board if any appears outside the quote
form's budget dropdown. It passes today (0 prices across 65 pages).

## 2. Per-model documents — already wired, awaiting real files

Each model's frontmatter carries a `downloads:` array:

```yaml
downloads:
  - label: "UKU 160 — Specification Sheet"
    file: "/docs/uku-160-specification.pdf"
```

With a `file:` set, the product page renders a tracked download link
(`document_download` event, with model and label). With none set — the state
of every model today — it shows the "Technical documents are being prepared"
panel plus the Request Specifications CTA, which routes into the normal
enquiry pipeline.

**This is the architecture the future BUXENA proposal/presentation system
plugs into.** When real documents exist:

1. Place the PDF in `public/docs/`.
2. Add the `downloads:` entry to that model. Done — link, tracking and the
   removal of the fallback panel are automatic.
3. To auto-send after an enquiry: the acknowledgment email
   (`src/lib/send-customer-ack.ts`) already receives the model on every
   submission, so attaching or linking that model's document is a small,
   contained addition — no new pipeline needed.
4. When prices are approved, the same document can carry them, sourced from
   the register above so the PDF and the website can never disagree.

**No document may be generated from invented specifications or unapproved
prices.** The blocker is supplier material (spec sheets, manuals, warranty
terms), tracked in `docs/pricing-and-documents-readiness.md`.

## 3. Known data gap

**ITI Thermowood 2.3m has no verified seating capacity.** Not in the content,
the supplier workbook, or any document on hand. The model correctly appears
under every other filter and its page shows "Contact us for details" rather
than a guess. One confirmed line from Capra closes it.

*Last updated 2026-08-11.*
