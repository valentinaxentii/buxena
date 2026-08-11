# BUXENA — Advertising & Acquisition Launch Plan

**NOTHING IN THIS FILE IS ACTIVE. No account created, no pixel installed,
no dollar spent. Every spend requires Valentin's explicit approval first.**

## Launch gates (from the founder's own rule — all must be green before any ad runs)

| Gate | Status |
|---|---|
| Lead capture works | ✅ tested end-to-end (all 7 forms → CRM verified) |
| Conversion tracking works | ✅ dataLayer events firing; ⚠️ vendor tag (GA4/Meta pixel) not installed — needs account IDs + approval |
| Forms tested | ✅ incl. failure/retry/no-data-loss |
| Pricing/claims credible | ⚠️ **blocked on approved "From" prices** (Capra reply) and image rights |
| Product pages ready | ✅ structure; ⚠️ images unapproved for ads |
| Mobile ready | ✅ |

## 1. Google Search — FIRST channel (highest intent)

Campaign structure (5 ad groups, exact/phrase, purchase intent only):
1. **Outdoor sauna** — outdoor sauna, outdoor sauna for sale, backyard sauna, outdoor sauna kit → land `/saunas/outdoor-saunas/`
2. **European/Finnish** — european sauna, scandinavian sauna, finnish sauna for sale → land `/saunas/` (or a future `/european-saunas/` page)
3. **Design/premium** — modern outdoor sauna, luxury outdoor sauna, glass sauna, architectural sauna → land `/saunas/cube-saunas/`
4. **Product types** — cube sauna, barrel sauna for sale, indoor sauna → land matching category page
5. **Trade/commercial** — commercial sauna, sauna for hotel/spa → land `/for-trade/`

Negative keywords from day one: free, plans, DIY, build your own, used, repair, parts, jobs, rental, infrared (unless BUXENA sells infrared), blanket, hat.

Attribution already works: gclid + UTMs + referrer + landing page are captured on every form submission automatically.

## 2. Meta (Facebook/Instagram) — second
- **Prospecting:** lifestyle/architectural creative → `/see-it-in-my-space/` and category pages.
- **Retargeting audiences** (dataLayer events already fire for all of them): product viewers, pricing clickers, advisor users, quote starters, space-flow users, quote abandoners (started-not-submitted).
- Creative concepts prepared: single-image "backyard transformation," carousel (model range with From-prices once approved), Reels (steam/heat mood + See It In My Space demo), lead copy ("Your backyard. Your ritual. Priced for your ZIP."). **All creative blocked on image rights until supplier permission lands.**

## 3. Pinterest — discovery/retargeting only until data proves direct conversion. Boards: luxury backyard, outdoor wellness, sauna architecture, home spa. Pins → category pages + advisor.

## 4. YouTube — production list (organic first, ads later): choosing an outdoor sauna · barrel vs cube · what an outdoor sauna really costs · site preparation · electrical requirements · European buying guide · how BUXENA delivery works · HUUM vs Harvia (factual).

## 5. Trade lead gen — `/for-trade/` is live with Submit Project/Request Specs/Talk to BUXENA + file metadata upload. Outreach targets: architects, builders, interior/landscape designers, pool companies, developers, hotels, wellness/gyms. "Request Trade Pricing" = same form, trade source tag (no trade discount promised — none exists yet).

## 6. Landing pages
Use existing routes — no duplicates: `/saunas/outdoor-saunas/`, `/cube-saunas/`, `/barrel-saunas/`, `/indoor-saunas/`, `/for-trade/`, `/see-it-in-my-space/`, `/plan-your-sauna/`, `/quote/`. Each already has: intent-matched H1, product grid, trust strip elements, short form path, Request Pricing + advisor CTAs. Future additions when justified by spend: `/european-saunas/`, `/sauna-project-pricing/`.

## 7–8. Tracking & metrics
Client events: all firing (see `src/lib/track.ts` — ~60 events incl. every name in the founder's list or a direct equivalent; `quote_created/quote_sent/deposit_recorded/order_created` are CRM-side facts recorded as quote/order statuses in admin, which analytics reads from the database, not the browser). Attribution stored with each lead via the enquiry message context.
Admin reporting today: leads by source, pipeline, quote conversion, revenue, gross margin (live Analytics page). **Gap for ROAS: an ad-spend input** (spend per channel/month) — needs either a small table (schema change → will ask first) or a simple settings field. Until then: CPL/CAC computed manually from channel dashboards ÷ CRM lead counts.
Success measures: qualified leads → quotes → deposits → profitable sales. Never clicks.

## 9. Three budget options (proposals only — NOT activated)

| | CONSERVATIVE | TEST | AGGRESSIVE |
|---|---|---|---|
| Monthly | $1,000 | $2,500 | $6,000 |
| Google Search | $800 | $1,750 | $3,500 |
| Meta retargeting | $200 | $500 | $1,500 |
| Meta prospecting | — | $250 | $1,000 |
| Objective | 8–15 qualified leads; prove funnel | 25–40 leads; find winning keywords/models | scale winners across NE markets |
| Landing | outdoor + cube category pages | + barrel, indoor, trade | + advisor/space flows |
| Success looks like | CPL < $80, ≥2 quotes | CPL < $60, ≥1 deposit | CAC < 10% of AOV |
| Failure means | fix pages/offer before more spend | kill losing groups, keep winners | halt scaling, return to TEST |

## 10. First 30 days
**W1:** install GA4 + Meta pixel (needs your account IDs + approval) · finalize prices on 3 models · resolve P0 image rights · organic IG/Pinterest posting starts · Capra co-marketing ask.
**W2:** launch CONSERVATIVE Google Search only (with approval) · trade outreach emails begin (10/week) · first YouTube script.
**W3:** analyze search terms, CPL, lead quality in CRM · prune negatives · A/B landing headline.
**W4:** shift budget to winning ad groups/models · start Meta retargeting on accumulated audiences · review vs success table · decide TEST-level upgrade.
Ongoing organic: 3 IG posts/wk (rights-cleared imagery only), Pinterest pinning, 1 SEO guide/wk (cost guide first), referral ask in post-delivery email.

## 11. Scale rule (standing)
Spend scales ONLY on evidence of: traffic → qualified leads → quotes → deposits → profitable sales. Rising traffic alone never justifies budget increases.

*Prepared 2026-08-10. Requires Valentin's approval at every spend decision.*
