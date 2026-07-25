# BUXENA Admin Portal — setup & status

Internal business system at `/admin`, gated behind `/login`. Built on top of
the existing static Astro site — the public site is completely unaffected;
see "Architecture" below for why.

## 1. Set up Supabase (one-time)

1. Go to [supabase.com](https://supabase.com), create a free project.
2. In the project, go to **Settings → API** and copy three values:
   - **Project URL**
   - **anon / publishable key**
   - **service_role key** (click "reveal" — keep this one secret)
3. Go to **SQL Editor → New query**, paste the entire contents of
   `supabase/schema.sql` from this repo, and run it. This creates every
   table, the `updated_at` triggers, the generated landed-cost/margin
   columns on `orders`, and baseline RLS policies. Safe to re-run.

## 2. Set environment variables

Copy `.env.example` to `.env` for local dev and fill in the three values
from step 1:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

For the deployed site, set the same three in **Netlify → Site settings →
Environment variables**, then trigger a new deploy.

## 3. Create your first staff login

Supabase's own `auth.users` table *is* the login system — there's no
separate password table to manage.

1. Supabase dashboard → **Authentication → Users → Add user**.
2. Enter an email and password, and tick **Auto Confirm User** (so it
   doesn't wait on a confirmation email you haven't set up).
3. Optional but recommended — give that person a name in the app: SQL
   Editor →
   ```sql
   insert into profiles (id, full_name, role)
   values ('<paste the user's UUID from the Users list>', 'Your Name', 'admin');
   ```
4. Go to `/login` on the site and sign in with that email/password. You'll
   land on `/admin`.

To add more staff later, repeat step 1 (this project uses one flat staff
role today — see "What's not built yet" for a real roles/permissions model).

## 4. What was built (Phase 1)

- **Auth**: real server-side sessions via Supabase Auth, HttpOnly cookies,
  no passwords or keys ever sent to the browser. `/admin/*` is protected by
  `src/middleware.ts` — visiting any admin URL while logged out redirects to
  `/login`; logging in redirects back to where you were headed.
- **Database**: full relational schema in `supabase/schema.sql` — profiles,
  suppliers, products, customers, leads, quotes, quote_items, inventory,
  orders, enquiries, documents, activities. RLS enabled on every table.
- **Dashboard** (`/admin`): live KPIs (new leads, quote requests, open
  quotes, follow-ups due, orders in progress, stock on hand, incoming
  inventory, new enquiries) and a sales-pipeline stage breakdown, both
  queried live from the database (they'll read 0 until you add data).
- **Leads, Customers, Products** (`/admin/leads`, `/admin/customers`,
  `/admin/products`): full list + search/filter + create + edit + delete,
  backed by real Supabase queries.
- **Quotes** (`/admin/quotes`): create/edit with dynamic line items,
  delivery/installation/discount/tax, live-calculated subtotal and total.
  "Generate PDF Quote" is visibly present but disabled — it is **not**
  implemented, and I did not fake it.
- **Enquiries** (`/admin/enquiries`): the Sauna Advisor chat widget now
  records every conversation here automatically in the background (see
  `src/pages/api/enquiries.ts`) — this was explicitly requested and is real,
  not a placeholder. The chat's own canned-response behavior is completely
  unchanged; the recording is fire-and-forget and never blocks or breaks it.
- **Inventory, Orders, Documents, Analytics, Settings**: protected routes
  exist and are in the nav, but show an honest "coming in Phase 2" notice —
  see below.

## 5. What's NOT built yet (Phase 2, and beyond)

- **Inventory** screen (table + schema exist; UI doesn't).
- **Orders** screen (table + generated landed-cost/gross-profit columns
  exist; UI doesn't).
- **Documents**: no file upload yet — needs Supabase Storage configured
  first, then an upload UI.
- **Analytics**: no charts yet beyond the Dashboard's pipeline breakdown.
- **Settings**: no company info / tax defaults / lead-source management UI.
  Staff accounts are managed directly in Supabase for now.
- **Quote PDF generation**: architecture is ready (a quote + its items is a
  clean, self-contained record) but no PDF library is wired up.
- **Website quote form → enquiries**: the public `/quote/` form still
  submits via **Netlify Forms**, unchanged. Only the Sauna Advisor chat
  writes to `enquiries` right now. Connecting the quote form too is a small
  follow-up, but it's a real decision point: either point the form directly
  at a new API route instead of Netlify Forms, or keep Netlify Forms and add
  a Netlify outgoing webhook into Supabase. I didn't make that call for you.
- **Email notifications on new leads/enquiries**: not built. Needs an email
  provider (e.g. Resend, Postmark) and its own API key — flagged, not done.
- **Roles/permissions**: everyone who can log in can do everything. Fine for
  "one shared login," not fine once there are several distinct staff
  accounts with different access levels.
- **Multiple staff accounts** with per-person names/roles: the `profiles`
  table supports it; there's no UI to manage it yet (see Settings above).

## 6. Security notes to review before production

- **Rotate the Supabase keys once** if you ever pasted them anywhere other
  than Netlify's environment variables UI or your local `.env`.
- The `service_role` key bypasses every RLS policy by design — it's only
  ever read from `src/lib/supabase-admin.ts`, which is never imported by
  anything client-side. Worth a periodic grep for `SUPABASE_SERVICE_ROLE_KEY`
  to confirm that stays true as the codebase grows.
- RLS policies currently only grant `authenticated` role **read** access, as
  a defense-in-depth backstop — all real writes go through the server using
  service_role. If you ever add client-side Supabase calls, you'll need to
  add write policies deliberately; don't assume they're already there.
- `/admin` and `/login` are excluded from the sitemap and disallowed in
  `robots.txt`, but that's not access control — the middleware is. Don't
  rely on robots.txt for privacy.
- No rate limiting on `/login` or `/api/enquiries` yet — someone could
  hammer either with requests. Low risk for an internal tool with one login,
  worth revisiting if this becomes customer-facing at any point.
- `/api/enquiries` accepts unauthenticated POSTs by design (it's the public
  chat widget's own capture endpoint) — it can only ever INSERT into
  `enquiries`, nothing else, so the worst case is spam rows, not a data leak.

## 7. Architecture — why the public site isn't affected

The whole site still builds with `output: 'static'` (the Astro default) —
every public page is prerendered to plain HTML exactly as before, on the
same hosting, with the same bundle. Only `/login`, `/admin/*`, and the two
`/api/*` routes opt out via `export const prerender = false`, so *only*
those specific routes run as an on-demand Netlify Function. No Supabase
client, no admin CSS, no admin JS is ever included in a public page's
output — Astro compiles each route independently. `robots.txt` /
`sitemap.xml` also exclude the private routes.
