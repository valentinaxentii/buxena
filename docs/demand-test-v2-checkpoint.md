# BUXENA V2 — inquiry launch checkpoint

Updated September 14, 2026 — second pass, same day. Work is on `buxena-v2`:
the inquiry changes are saved in `1077925`, and the supplier-image follow-up
recovered from the handoff bundle (`cf1c514`) was integrated selectively, only
where this workspace did not already have equal or better work.
This checkpoint supersedes older launch-readiness summaries. No deployment,
production change, advertising, customer email or inventory purchase was made.

## Commercial direction

Valentin and Oleg are postponing a speculative container order while testing
whether customers accept a profitable complete-package price and delivery wait.
The website should let visitors browse the existing catalogue, select a model
and send a free inquiry. An inquiry is neither an order nor a stock reservation.
Do not interpret the older “first order will be 40HC” plan as authorization to
buy inventory now. Deposits, advertised prices and paid advertising still need
the relevant commercial decisions. V1/main remains protected.

## Changes prepared

- Homepage, catalogue, product and quote pages explain the free inquiry process.
- Budget is collected with the first pricing request; purchase timing remains
  there too. Budget bands are explicitly project budgets, not advertised prices.
- Optional details collect placement and timing flexibility, plus the existing
  capacity, installation, foundation, electrical, notes and upload fields.
- Campaign attribution follows catalogue → product → inquiry within the tab
  for up to 30 minutes. Only the landing path, external referring hostname and
  standard UTM fields are retained. Arbitrary query fields, full referrer URLs
  and click IDs are excluded. Storage failures cannot block an inquiry; GPC/DNT
  suppress attribution.
- Quote form submit events are routed by step. Repeated submissions are blocked
  while sending. The initial button stops being a submit control after capture,
  so keyboard submission in step two targets the optional details. Those details
  carry the first enquiry ID; uploads start only after acceptance of the details.
- The mobile quote layout puts the form before the supporting sidebar.
- The prelaunch script owns a separate safe-mode test server, reads its logs
  directly, keeps it through the runtime route sweep, then closes it. It never
  reuses a potentially live local server.
- This pass: the EDA 160 hero became Capra's own 1,6 m product-page file (the
  last image blocker), product pages gained an "images may show optional
  features — your written quote confirms what is included" note, and
  `docs/image-sources-2026-09-14.json` now records the shipped assets and the
  recovered bundle record with supplier pages and checksums.
- This pass also checked in the inquiry-flow browser QA as
  `scripts/browser-flow-qa.mjs` (`npm run qa:flow`), so the desktop/390 px
  journey can be re-run by anyone from one command.
- Corrective commit `dd5fe03` restores the ULLA model and its assets, after the
  founder declined the earlier unapproved removal. It contains only those
  previously tracked ULLA paths (byte-identical to their earlier content) and
  reverts nothing else.

## Verified at this state

Every row was produced by a command in this repository, in safe mode, at the
state committed here. The production build was local; nothing was deployed.

| Check | Result |
| --- | --- |
| Astro check | 0 errors, 0 warnings; 182 informational hints |
| Unit tests | 170 passed, 0 failed |
| Production build (`npm run prelaunch`) | Passed locally with the normal dev setup; output not deployed |
| Pre-launch board | **25/25 GREEN** — 100 pages, 66 product pages, 6295 references, all 100 routes rendered on a live server |
| Image integrity | Passed — 67 models, 66 with photography, every declared image resolves |
| Image rights audit | Passed — 22 blocked paths checked across 100 HTML pages; 2 NORD interiors still report as website-cleared, advertising-blocked |
| Public claims audit | Passed, 100 built HTML pages |
| Electrical/compliance claims guard | Passed, 210 source files |
| Security audit | 20/20 |
| Sales funnel audit | 18/18 |
| Inquiry API sources | 10/10 accepted in safe mode; 9 customer-ack previews, 1 enrichment skip; nothing sent |
| Browser flow QA, desktop 1440 + mobile 390 (`npm run qa:flow`) | **26/26 passed**, exit 0 |

The board counts above were measured before the ULLA restoration (100 pages,
66 product pages). After that corrective commit only the affected pages and
assets were re-checked, as instructed: `/saunas/bux-ulla/`, `/saunas/`,
`/saunas/cube-saunas/`, `/saunas/outdoor-saunas/` and `/compare/` all render
with ULLA listed again, and all twelve restored ULLA files (hero, both source
photographs, six normalized/source optimized variants and the presentation PDF)
serve with the correct content types. The full board was deliberately not
re-run, so those counts are pre-restore figures.

The browser pass covered the real journey end to end: homepage → catalogue →
model page (hero is local, every image decodes, model preselected on the page's
own enquiry form) → the product CTA's in-page `#enquire` anchor → the standalone
`/quote/?model=` form carrying the same model; at 390 px the form precedes the
sidebar, the grid collapses to one column and nothing scrolls sideways. It then
proved one request per rapid double-click, budget + timing reaching the request,
UTM retained while a click id and fragment are dropped, the first button ceasing
to be a submit control so Enter in step two targets the optional details, details
merging into the same enquiry id, a late click unable to duplicate them, a forced
failure shown with every answer kept, and skip neither navigating away nor
opening a live lead. The only real-browser code fix needed was in the QA script
itself (it expected the product CTA to navigate to `/quote/`; the site's CTA is
an in-page anchor, so the check now asserts both the anchor and the linked
`/quote/?model=` form).

These are code, build, local runtime and real-browser checks against a local
safe-mode server. They still do not prove live CRM persistence, live mail
delivery or Netlify edge emulation, and no screenshot pass is claimed beyond
these assertions. Unlike the earlier Codex environment, this laptop's normal
`npm run prelaunch` completed without setting `NETLIFY_DEV`: the Netlify Vite
emulator did not raise its network-interface error here, so no workaround was
needed and neither the adapter nor the production configuration was changed.
The QA server always forces `BUXENA_SAFE_MODE=true` and
`ENQUIRIES_DEV_LIVE=false`; every browser submission was intercepted locally
except the single safe-mode API pass, which stores and sends nothing.

## Remaining launch work

1. Item 3 of the previous pass is **done** — the desktop and 390 px journeys were
   verified in a real browser (26/26, above): model preselection, budget/timing
   reaching the request, one submission per click burst, Enter targeting the
   optional details, a failure that keeps every answer, and clear skip/details
   behaviour.
2. Image work for the previously-blocked placements is **done** — EKE 160, the
   EDA 130/200/235 group and the EDA 160 hero now use verified CAPRA material or
   cutouts traced to it. Files, supplier pages, build method and checksums are
   in [`docs/image-sources-2026-09-14.json`](image-sources-2026-09-14.json) with
   the scores in [`docs/capra-image-trace-2026-09-14.md`](capra-image-trace-2026-09-14.md).
   Replaced files stay on the rights blocklist and are referenced nowhere.
3. Verify the intended launch environment and live inquiry delivery separately
   before publication. Safe-mode success is still not evidence of a real stored
   lead, and this needs explicit approval plus live credentials.
4. Keep exact public prices unapproved until current supply, U.S. heater costs,
   freight, import charges, delivery and included work support them. The public
   pricing register remains empty and the build asserts it.
5. Confirm the launch selection and who answers inquiries during travel.
   Approval to publish V2 remains outstanding.

## Open decisions — founder only, not resolvable from code

1. **ULLA.** An earlier session removed the ULLA model, and the founder did not
   approve that. It has been restored byte-identically (content file, three
   source images, its presentation PDF and eight optimized variants) in the
   corrective commit `dd5fe03`; nothing else was reverted. Its image-rights
   position is unchanged — excluded from the 2026-08-11 grant, covered only by
   the 2026-08-17 founder exception for its existing catalogue photograph, and
   not cleared for paid advertising. The launch decision on ULLA remains open.
2. **Paid advertising.** Two NORD interior images are website-cleared but
   advertising-blocked, and VIRU/NORD website permission is still not on file.
3. **Live delivery.** CRM rows, staff email and Telegram remain unproven from
   this machine, by design.

## Demand measurement

Attribution is now attached to inquiry submissions. Existing `dataLayer` events
are only a browser queue unless an analytics provider is configured and verified.
They are not historical statistics, and this work did not activate one.

Measure qualified inquiries, acceptance of complete quoted prices, acceptance
of waiting time, orders/cancellations and contribution after acquisition cost.
Visitor counts and product-view conversion rates require a verified analytics
collection setup. Do not count budget selection or a free inquiry as a sale.

## Continue from here

Preserve this branch and every catalogue entry. Do not publish invented prices,
modify main/V1, or deploy. Changes are committed locally; no push is included
because the hosting branch-deploy configuration has not been verified. The next
real step is the launch review with the founder: settle the ULLA decision,
confirm who answers inquiries during travel, then verify live inquiry delivery
deliberately and only with explicit approval.
