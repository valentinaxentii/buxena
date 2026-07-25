# BUXENA Admin Portal — session handoff

Written to pick this up cold in a future session with the same context I have
right now. If you're reading this to resume work, start with "Where things
actually stand" below, then skim the rest as needed.

## The original ask, verbatim

This is the spec that drove everything built so far — keeping it word-for-word
so nothing gets reinterpreted differently next time:

> Build a professional private **BUXENA Admin Portal** for staff use only.
>
> The goal is to create a secure internal business control center for managing leads, quotes, customers, products, inventory, orders, documents, and website enquiries.
>
> Start with a clean, production-ready foundation. Do not overbuild unnecessary ERP features.
>
> **Authentication**: `/login` — email, password, sign in, forgot password, secure auth, protected admin routes, redirect to `/admin`, never fake frontend-only auth, never store passwords in localStorage, never expose secrets in frontend code. Use Supabase for auth + database since nothing existed already.
>
> **Dashboard** (`/admin`): KPIs — new leads, new quote requests, open quotes, customers awaiting follow-up, orders in progress, units in stock, incoming inventory, recent website enquiries. Sales pipeline: New Lead → Contacted → Qualified → Quote Sent → Negotiating → Won → Lost. Prominent **+ New Quote** button.
>
> **Leads** (`/admin/leads`): name, email, phone, state, source (Website/Instagram/Facebook/Google/Referral/Manual), sauna model of interest, indoor/outdoor, budget, heater preference, timeline, notes, follow-up date, assigned staff, status.
>
> **Customers** (`/admin/customers`): contact info, location, lead source, notes, quotes, orders, messages, follow-up history, documents.
>
> **Quotes** (`/admin/quotes`): customer, sauna model, base price, heater, accessories, delivery, installation, discount, taxes, total, quote date, expiry date, status (Draft → Sent → Viewed → Negotiating → Accepted → Declined → Expired). Architecture for future "Generate PDF Quote" — explicitly do not fake PDF generation if not implemented.
>
> **Products** (`/admin/products`): model name, supplier, category, EXW/cost, selling price, dimensions, capacity, timber type, glass configuration, heater options, electrical requirements, weight, shipping dimensions, stock quantity, images, brochure, installation manual, warranty document, active/inactive.
>
> **Inventory** (`/admin/inventory`): model, in stock, incoming, reserved, available (= in stock − reserved, auto-calculated), supplier, container number, PO, ETA, port, warehouse, landed cost.
>
> **Orders** (`/admin/orders`): workflow Deposit Received → Ordered → In Production → Shipped → At Port → Warehouse → Delivery Scheduled → Delivered → Installed. Customer, sauna, heater, accessories, selling price, deposit, balance, supplier, PO, container, ETA, delivery address, installation status, notes.
>
> **Landed cost & margin**: product cost + ocean freight + customs/duty + port handling + inland delivery + warehouse cost + installation cost + other cost → Landed Cost. Gross Profit = Selling Price − Landed Cost. Gross Margin %.
>
> **Enquiries / Sauna Advisor** (`/admin/enquiries`): website forms and the Sauna Advisor chat should create leads/enquiries automatically. Store name, email, phone, location, message, full chat transcript, sauna interest, date/time, source, status. Do not break the current Sauna Advisor.
>
> **Documents** (`/admin/documents`): supplier price lists, brochures, installation manuals, electrical specs, warranty docs, customs docs, container docs, customer quotes, invoices — associated with the relevant supplier/customer/product/quote/order.
>
> **Analytics** (`/admin/analytics`): leads by source, leads by state, quote conversion, sales pipeline, most-requested models, revenue, gross margin.
>
> **Settings** (`/admin/settings`): company info, staff users, quote defaults, tax settings, delivery defaults, email settings, lead sources.
>
> **Design**: match BUXENA's visual identity — dark charcoal/black, warm cream, refined gold accents, thin elegant typography. Professional and usable, not decorative. Sidebar nav, tables, filters, search, status badges, simple forms, responsive.
>
> **Database**: proper relational model — users, leads, customers, quotes, quote_items, products, suppliers, inventory, orders, enquiries, documents, activities. Foreign keys, sensible relationships.
>
> **Security**: protect all `/admin/*` routes, secure auth, validate inputs server-side, never expose service-role keys, never hardcode passwords, use env vars, RLS where applicable.
>
> **Phasing**: Phase 1 = Auth, Dashboard, Leads, Customers, Quotes, Products. Phase 2 = Inventory, Orders, Enquiries, Documents, Analytics.
>
> Plus, added after Phase 1: **email notifications when a new website lead or quote request arrives** — flagged as more valuable early than further admin depth, not yet built.

Two decisions were confirmed with the user before building (via explicit
choice, not assumed): **one shared admin login** (not per-person accounts
yet), and it's fine for Phase 2 sections to start as protected placeholders
rather than full CRUD.

## Session update — 2026-07-25 (same day, continued)

Immediately following the batch above, the user asked to finish the entire
admin system in one pass: real Orders shipping/install fields, real
Analytics, real Documents, real Settings, and a full placeholder sweep. All
done, build (`npm run build`) and `npx astro check` both clean except for
61 pre-existing type errors in the **public site's** `saunas/*` pages
(implicit-`any` params) — confirmed via `git status` to be files this
session never touched, not a regression.

**Database changes — you need to re-run `supabase/schema.sql` in the
Supabase SQL editor.** It's still fully idempotent (every statement is
`if not exists` / safe to re-run), but this session added real schema, not
just app code:
- `orders`: 6 new nullable columns — `production_completion_date`, `etd`,
  `port`, `warehouse`, `delivery_date`, `installation_date`. (`eta` and
  `installation_status` already existed.)
- `documents`: new nullable `notes` column, plus the `category` CHECK
  constraint widened to add Purchase Order / Shipping Document /
  Installation Document / Product Specification — every previously-valid
  category value is still valid.
- **New `settings` table** — a singleton row (`id` pinned to 1) holding
  company info, PDF tagline, currency, default tax rate, default quote
  validity days, default deposit %, default port/warehouse, quote/order
  number prefixes, and the lead-sources list. `src/lib/settings.ts`'s
  `getSettings()` reads it with a hardcoded fallback if the table/row is
  missing, so no page crashes if you haven't re-run the schema yet.
  Explicit per-table grant added proactively (see the grants gotcha above).
- **`leads.source` CHECK constraint relaxed** — it used to whitelist exactly
  6 hardcoded values; now it just requires non-empty text, because Lead
  Sources is a Settings-managed list now (`settings.lead_sources`), not a
  fixed enum. This was a deliberate, disclosed change, not an accidental
  side effect — flagged to the user in the same turn it was made.

**What got wired to Settings** (i.e. no longer hardcoded): quote/order
number prefixes (`Q-`/`O-` were literals, now `settings.quote_number_prefix`/
`order_number_prefix`), quote default tax rate + expiry-date-from-validity-
days, order default deposit % (used when converting an accepted quote),
default Port/Warehouse prefill on Inventory and Orders forms, and the PDF
generator's company name/email/website/tagline/currency (was hardcoded
'BUXENA'/'info@buxena.com'/'buxena.com'/'Where Wellness Starts'/USD
throughout `src/lib/pdf/build-quote-pdf.ts`).

**Real pages, not placeholders, as of this session**: Inventory, Orders
(now with the full shipping/install timeline), Analytics (14 live KPI tiles
+ 6 bar-chart breakdowns, date-range filter, zero mock data), Documents
(real CRUD, category/search filters, linked-record display — file *storage*
is explicitly not configured, see the callout on that page itself), and
Settings (editable, persisted to the new table). The sidebar's "Phase 2" nav
group label is gone too — one flat nav list now (`src/layouts/AdminLayout.astro`).

**Genuinely still not done, disclosed rather than faked**: Documents file
*upload* (no Supabase Storage bucket exists — the page explains exactly what
config step is missing), email notifications on new leads/enquiries, the
public `/quote/` form still isn't wired into `enquiries`, and
roles/permissions beyond the one shared login.

## Session update — 2026-07-24

Picking up after Phase 1 sign-in verification, the user drove a rapid-fire
batch of Phase 2 feature requests in one sitting (pasted from another AI
conversation). Built, in order, all verified via `npm run build` + route
smoke tests (dev server was already running locally with real Supabase data
during this session — products table was confirmed empty at the start):

1. **Sauna Model dropdown fix** (`src/pages/admin/quotes/new.astro`) — now
   filters `is_active = true`, sorted alphabetically, shows "No sauna models
   available" instead of a bare "— none —" when the table is empty.
2. **Real PDF Quote generator** — `src/lib/pdf/build-quote-pdf.ts` (pdf-lib,
   not pdfkit — deliberately chosen because pdfkit reads AFM font files off
   disk at runtime, which is fragile inside bundled serverless functions;
   pdf-lib's standard-14 fonts are pure JS, no runtime file reads, verified
   bundle-safe in the Netlify function build). 6-page branded proposal
   (cover, selected sauna, configuration, investment/pricing table, delivery
   & installation, warranty & terms), BUXENA cream/charcoal/gold styling,
   logo embedded as a base64 constant (`src/lib/pdf/logo-base64.ts`, from
   `public/brand/buxena-logo-espresso.png`) so nothing reads from disk at
   request time. Served from `src/pages/admin/quotes/[id]/pdf.ts` (GET,
   under `/admin/*` so the existing middleware auth-gates it — deliberately
   *not* under `/api/*`, which is unauthenticated by convention here).
   Button on the quote detail page is only enabled once customer + sauna
   model + at least one line item exist; otherwise it's disabled with a
   visible "Add X, Y to enable PDF generation" note. **Known content
   caveat**: warranty summary, payment terms, and delivery/site-readiness
   copy are static placeholder boilerplate (`WARRANTY_SUMMARY`,
   `PAYMENT_TERMS`, `TIMELINE_NOTES`, `SITE_READINESS_NOTES` constants at
   the top of `build-quote-pdf.ts`) — no real warranty duration or deposit
   percentage exists anywhere in the system, so nothing was fabricated;
   these are the first thing to edit once real terms are decided.
   **Gotcha hit and fixed**: pdf-lib's WinAnsi encoding cannot render the
   Unicode minus sign `−` (U+2212) — only plain hyphen `-` (U+002D). Any new
   text in this file must stick to WinAnsi-safe characters (smart quotes,
   em/en dashes, and `×` are fine; math minus is not).
3. **Reusable model-selector component** — `src/components/admin/ModelSelect.astro`.
   A vanilla-JS (no framework) searchable combobox: type-to-filter over
   active products sorted alphabetically, a hidden input carries the real
   `product_id`, an always-visible "+ Add New Model" row opens
   `/admin/products/new` in a new tab, never writes to `products` itself
   (so it can't create duplicates). Dispatches a bubbling
   `modelselect:change` CustomEvent with `{ product }` in its detail: each
   consuming page owns its own autofill logic, tracking a per-field
   `data-autofilled` flag so a model swap never clobbers a value the admin
   typed by hand. Wired into the only four forms that actually reference a
   sauna model today: Quotes new/edit and Leads new/edit. Products' own
   "Model Name" field stays plain text, since that's where a model is first
   created.
4. **Real Inventory page** (`src/pages/admin/inventory/{index,new,[id]}.astro`) —
   replaces the Phase 2 placeholder. List has search (by model name),
   supplier filter, sortable columns, computed Inventory Value
   (`in_stock × landed_cost`, falling back to product cost if no landed
   cost recorded yet). Add/edit forms use ModelSelect and auto-fill
   Supplier from the product's `supplier_id`. "Available" is never a form
   field — it's the DB's generated column (`in_stock - reserved`), shown
   read-only.
5. **Real Orders page** (`src/pages/admin/orders/{index,new,[id]}.astro`) —
   replaces the Phase 2 placeholder. Full workflow status, cost breakdown
   (product/freight/customs/port/inland/warehouse/installation/other) with
   a live client-side landed-cost/margin preview mirroring the DB's
   generated `landed_cost`/`gross_profit` columns (list/detail read from
   the existing `orders_with_margin` view for `gross_margin_pct`). An
   Accepted quote now shows a **Convert to Order** button
   (`/admin/orders/new?from_quote=<id>`) that prefills customer, product,
   heater, and selling price from the quote — becomes **View Order** once
   converted (checked via `orders.quote_id`, so it can't double-convert).
   Creating an order reserves one unit against the product's inventory row
   with the most availability (`src/lib/inventory-reservation.ts`);
   deleting an order releases it. **Deliberately scoped to "one order = one
   unit"** — there's no quantity column on `orders`, so this matches the
   schema as built rather than inventing one.

**Schema gap flagged, not silently resolved**: the user's Orders request
asked for Production Completion Date, ETD, Port, Warehouse, Delivery Date,
and Installation Date as order fields. None of those columns exist on
`orders` (`supabase/schema.sql`) — Port/Warehouse exist only on `inventory`.
Per the user's own "do not redesign the database unnecessarily" instruction
(said about Inventory, applied here too), these were **not** added as new
columns and **not** faked with placeholder values — they're just absent
from the Orders form. This needs an explicit decision (a migration) before
it can be built, same category of decision as the email-notification
provider below.

**Audited but intentionally left alone**: Documents, Analytics, and
Settings are still real "Coming in Phase 2" placeholders
(`src/pages/admin/{documents,analytics,settings}/index.astro`) — the user
asked for and got a full audit of every such placeholder mid-session but
has not yet asked for these three to be built.

## Where things actually stand right now

**Phase 1 is built and locally verified working, end-to-end, against a real
Supabase project — except the actual browser sign-in click, which only the
user can do (their password was never shared, by design).**

Concretely, as of this session:
- Supabase project created, `supabase/schema.sql` executed successfully, RLS
  enabled, public signups disabled, first admin user created and confirmed,
  `profiles` row set to `role='admin'`.
- Local `.env` filled in with real `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` (typed directly into Notepad by the user — never
  pasted into chat, never displayed by Claude).
- **All 12 tables now confirmed readable via the service-role client**:
  profiles, suppliers, products, customers, leads, quotes, quote_items,
  inventory, orders, enquiries, documents, activities.
- Auth confirmed live: a deliberately-wrong sign-in attempt against the real
  project correctly returned "Incorrect email or password" (not a
  config-error notice), proving `SUPABASE_URL`/`SUPABASE_ANON_KEY` are wired
  correctly.
- `/admin/*` correctly redirects unauthenticated visitors to `/login`
  (middleware verified live, not just by reading the code).
- Production build (`npm run build`) succeeds cleanly; every public page
  still prerenders as static HTML exactly as before — zero impact on the
  public site's bundle or hosting.

**The one remaining unverified step**: an actual human clicking through
`/login` → typing real credentials → landing on `/admin` with data loading.
That was queued as the next action when this session's context got full.
Everything required for it to work has been independently verified — this is
very likely to just work.

## Important gotcha discovered this session — read before touching grants again

Supabase's **new API key format** (`sb_publishable_...` / `sb_secret_...`,
replacing the legacy JWT `anon`/`service_role` keys) is used in this project.

We hit a real, confusing bug: `service_role` (the `sb_secret_...` key) got
`permission denied for table X` (Postgres error 42501) even after running
`grant all on all tables in schema public to service_role;` — and even after
confirming Postgres itself reported the grant succeeded. The fix that
actually worked was re-running the grant **listing each table by name
explicitly**:

```sql
grant select, insert, update, delete on
  suppliers, products, customers, leads, quotes, quote_items,
  inventory, orders, enquiries, documents, activities
to service_role;
```

We never fully root-caused *why* the wildcard `ALL TABLES IN SCHEMA public`
form didn't take effect the first time (best guess: something about
execution order/timing across multiple statements in one query, or the
wildcard resolving against a stale table list at parse time — not confirmed).
**Takeaway for next time a table is added**: don't assume
`alter default privileges ... grant all on tables to service_role` (also in
`supabase/schema.sql`) will actually cover it — verify explicitly, e.g. with
the diagnostic approach below, and if it fails, grant that specific table by
name rather than re-running the wildcard again.

Diagnostic pattern that worked (safe, read-only, never prints key values):
a small Node script using `@supabase/supabase-js`'s `createClient` with the
service-role key, running `.from(table).select('id', {count:'exact',
head:true})` per table and reporting only pass/fail + row count. Also
useful: Postgres's own error `hint` field is often the exact fix.

Also learned: `Authorization: Bearer <key>` is fine for the new key format
*as long as it matches the `apikey` header exactly* — that was a red herring
we chased and ruled out.

## What's built (Phase 1)

- **Auth**: `src/middleware.ts` gates `/admin/*` and `/login`, using
  `src/lib/supabase-auth.ts` (anon-key, session/cookie-bound client, via
  `@supabase/ssr`'s `createServerClient`). `src/pages/login.astro` handles
  sign-in directly (POST to itself), sets HttpOnly cookies, redirects to
  `/admin` (or `?next=` target). `src/pages/login/forgot-password.astro` is
  an honest "contact the admin" stub — no email-reset flow exists.
  `src/pages/api/logout.ts` signs out.
- **Data access**: `src/lib/supabase-admin.ts` — service-role client, used
  only by `prerender = false` admin pages/API routes, never imported by
  anything client-side.
- **Database**: `supabase/schema.sql` — the full schema, triggers for
  `updated_at`, generated columns for `inventory.available` and
  `orders.landed_cost`/`gross_profit`, an `orders_with_margin` view for
  `gross_margin_pct`, RLS enabled everywhere (read-only for `authenticated`
  as a defense-in-depth backstop; real access is server-side via
  service_role), plus the table-level GRANT block (see gotcha above).
- **Dashboard** (`src/pages/admin/index.astro`): live KPI queries, pipeline
  stage counts, "+ New Quote" button.
- **Leads / Customers / Products**: full list + search/filter + create +
  edit + delete, real Supabase queries (`src/pages/admin/{leads,customers,
  products}/`).
- **Quotes** (`src/pages/admin/quotes/`): create/edit with dynamic line
  items, live-calculated subtotal/total (delivery + installation − discount,
  then tax). "Generate PDF Quote" button is visibly present but disabled —
  genuinely not implemented, not faked.
- **Enquiries**: `src/pages/api/enquiries.ts` is a public, unauthenticated
  POST endpoint (by design — it's the chat widget's own capture path) that
  writes to the `enquiries` table using the service-role client server-side.
  `src/components/ChatWidget.astro` now fires a best-effort, fire-and-forget
  call to it after every user message, with the running transcript. The
  widget's own canned-response behavior is 100% unchanged — this is
  additive only, wrapped in `.catch(() => {})`, so a missing/misconfigured
  Supabase project never breaks the visitor-facing chat.
  `src/pages/admin/enquiries/index.astro` is a real (simple) list view, not
  a placeholder, since data now genuinely flows in.
- **Inventory / Orders / Documents / Analytics / Settings**: real protected
  routes exist and are in the admin nav, but show an honest "coming in Phase
  2" notice. Tables for all of them already exist in the schema.
- **Shared UI**: `src/layouts/AdminLayout.astro` (sidebar nav, dark/gold
  theme), `src/styles/admin.css` (tables, badges, forms, KPI tiles, pipeline
  strip), `src/components/admin/StatusBadge.astro`.

## Architecture note — why the public site is unaffected

`astro.config.mjs` added the `@astrojs/netlify` adapter but kept the default
`output: 'static'`. Every public page still prerenders to plain HTML exactly
as before, same bundle, same hosting. Only `/login`, `/admin/*`, and the two
`/api/*` routes opt out via `export const prerender = false`, so *only* those
run as an on-demand Netlify Function. Confirmed via a full production build:
identical public page list, admin/API routes bundled separately into the SSR
function. `robots.txt` and the sitemap filter both exclude `/admin` and
`/login`.

## What's NOT built yet (Phase 2 and beyond)

Unchanged from `README-ADMIN.md` — see that file for the full list. Short
version: Inventory/Orders/Documents/Analytics/Settings UIs, quote PDF
generation, wiring the public `/quote/` form (still plain Netlify Forms) into
`enquiries`, **email notifications on new leads/enquiries** (explicitly
requested, not started — needs an email provider + its own API key, a
decision the user hasn't made yet), roles/permissions beyond one shared
login, and multi-staff account management UI.

## Immediate next steps, in order

1. User signs in at `/login` in their own browser with their real Supabase
   credentials, confirms redirect to `/admin` and that the Dashboard/Leads
   pages render without errors.
2. Set the same three env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`) in Netlify → Site settings → Environment
   variables, then redeploy.
3. Repeat the sign-in test against the live URL.
4. Decide on Phase 2 priority order and on the email-notification provider.

## Where everything lives (file map)

```
astro.config.mjs          — added @astrojs/netlify adapter, admin/login excluded from sitemap
.env.example               — the 3 required var names, no values
.env                        — real values, gitignored, never committed
README-ADMIN.md             — setup steps, env vars, first-user creation, security notes
HANDOFF.md                  — this file
supabase/schema.sql          — full DB schema + RLS + grants
src/middleware.ts            — /admin + /login route protection
src/env.d.ts                  — Locals.staffUser typing
src/lib/supabase-auth.ts       — anon-key, cookie-bound client (auth only)
src/lib/supabase-admin.ts       — service-role client (all data access)
src/layouts/AdminLayout.astro    — admin shell (sidebar, topbar)
src/styles/admin.css              — shared admin UI primitives
src/components/admin/StatusBadge.astro
src/pages/login.astro              — sign-in page + POST handler
src/pages/login/forgot-password.astro
src/pages/api/logout.ts
src/pages/api/enquiries.ts          — public capture endpoint for chat + (future) forms
src/pages/admin/index.astro          — Dashboard
src/pages/admin/leads/                — index.astro, new.astro, [id].astro
src/pages/admin/customers/
src/pages/admin/products/
src/pages/admin/quotes/
src/pages/admin/enquiries/index.astro    — real list, not a placeholder
src/pages/admin/{inventory,orders,documents,analytics,settings}/index.astro — Phase 2 placeholders
src/components/ChatWidget.astro            — modified: white/gold icon swap, auto-contrast fab, enquiry capture hook
```
