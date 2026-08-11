# BUXENA V2 — Launch Checklists

Created 2026-08-11. Three things the founder must do personally: look at the
site, set the environment variables, and run one controlled email test.

---

## 1 · Visual review checklist

Every item below has passed automated checking. What automation **cannot**
judge is whether it looks right — that is what this list is for. Tick as you go.

**Widths to test:** desktop 1440 · tablet 768 · mobile 390 (iPhone). Resize the
browser window rather than zooming; zoom hides layout bugs.

### Homepage
- [ ] Hero fills the screen; the sauna is not cropped awkwardly at any width
- [ ] Watch the hero for ~15s — the camera drift should be visible but calm
- [ ] Headline "Where Wellness Starts" sits on ONE line at 1440, 1280 and 1024
- [ ] Explore Saunas and Find Your Sauna both work and feel like the obvious next step
- [ ] Scroll slowly: sections reveal as they enter view, nothing jumps or flashes
- [ ] Mobile: no sideways scrolling anywhere; CTAs full-width and thumb-reachable

### Catalogue (/saunas)
- [ ] 32 models shown (3 held models must NOT appear)
- [ ] Filters: try Outdoor + Cube, then add Capacity, then Material
- [ ] Try a zero-result combination (Indoor + Barrel) → clear empty state + Reset
- [ ] Reset Filters returns all 32
- [ ] Mobile: filter drawer opens, closes, and does not trap scroll

### Collection pages (/saunas/barrel-saunas, cube, indoor, outdoor)
- [ ] Correct models in each; counts look right
- [ ] Cards align; no ragged rows at any width

### Product page (test at least ELLA, UKU 230, a barrel)
- [ ] Correct name, images, specs, capacity, material
- [ ] "Download Model Presentation (PDF)" is visible and opens the RIGHT model
- [ ] Sticky Request Pricing bar appears on scroll and retreats at the form/footer
- [ ] Chat bubble never covers the sticky CTA (check at 390 and 1280)
- [ ] Natural Wood note reads reassuring, not alarming
- [ ] NO price shown anywhere

### Model presentation PDF
- [ ] Opens in browser and downloads
- [ ] Page 1 cover, page 2 specs + configure, page 3 project — exactly 3 pages
- [ ] Correct model name AND BUXENA code
- [ ] No supplier name, no price, no CTA
- [ ] Legible on a phone screen

### Enquiry
- [ ] Submit Request Pricing from a product page
- [ ] Model is pre-selected
- [ ] Required-field validation triggers on empty submit
- [ ] Success state appears (locally: "Local test mode")

### Thank-you
- [ ] Confirms receipt clearly
- [ ] Shows the model you enquired about
- [ ] Offers a clear next step
- [ ] No promise of a specific response time

### Trade / professional (/for-trade)
- [ ] Reads professional and concise, not consumer-salesy
- [ ] Trade form works; submission confirms

### Cross-cutting
- [ ] Header nav + mobile drawer open/close cleanly
- [ ] Footer links all resolve
- [ ] Chat widget opens, closes, does not block content
- [ ] No layout shift as images load
- [ ] Reduced motion: enable Windows Settings → Accessibility → Visual effects →
      Animation effects OFF, reload — everything must still be readable and usable

---

## 2 · Netlify environment variables

Set at **Netlify → Site settings → Environment variables**. Values live only in
Netlify and your password manager — never in the repository.

| Variable | Purpose | Required for launch | Where to get the value |
|---|---|---|---|
| `SUPABASE_URL` | Server-side: stores every enquiry; powers admin | **YES** | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only full DB access. **SECRET** | **YES** | Supabase → Project Settings → API → service_role key |
| `SUPABASE_ANON_KEY` | Admin sign-in only | **YES** (admin unusable without it) | Supabase → Project Settings → API → anon/public key |
| `ZOHO_SMTP_USER` | Sends staff notification + customer acknowledgment | **YES** | The Zoho mailbox address, e.g. info@buxena.com |
| `ZOHO_SMTP_PASSWORD` | Zoho **App Password**, not the login password. **SECRET** | **YES** | Zoho → My Account → Security → App Passwords → generate |
| `ZOHO_SMTP_HOST` | Must be `smtp.zohocloud.ca` for the Canadian DC — the default `smtp.zoho.com` fails with 535 | **YES** | Known: `smtp.zohocloud.ca` |
| `ENQUIRY_NOTIFY_TO` | Where staff notifications land | NO — defaults to info@buxena.com | Your choice |
| `ZOHO_SMTP_PORT` | Defaults to 465 (implicit SSL) | NO | Leave unset unless Zoho says otherwise |
| `TELEGRAM_BOT_TOKEN` | Founders' group ping on new leads. **SECRET** | NO — email still works without it | Telegram @BotFather |
| `TELEGRAM_CHAT_ID` | The founders' group id (negative number) | NO | Add the bot to the group, then read the chat id |
| `ENQUIRIES_DEV_LIVE` | **Do NOT set in Netlify.** Local-only opt-in that lets a dev machine reach live services | NO — leave unset | n/a |

**Six are required for launch.** Without them, forms show a controlled error and
no lead is recorded.

**Verify after setting:** deploy a preview, submit one test enquiry, confirm the
row appears in Admin → Website Enquiries, then delete the test row.

---

## 3 · Controlled acknowledgment test

Run **one** test to your own address before launch. Procedure:

1. Set the six required variables in Netlify (above).
2. Deploy a **preview**, not production.
3. On the preview, submit one Request Pricing enquiry using your own email.
4. Confirm you receive the acknowledgment, that the model name is right, and
   that the presentation link opens the correct PDF.
5. Delete the test enquiry row in Admin → Website Enquiries.

The exact email that test will produce is in
`docs/acknowledgment-test-preview.md`.

---

## 4 · What automation already guarantees

So you know what NOT to spend review time on: 3,678 internal links resolve ·
35/35 PDF identities correct · 32/32 product pages link their own PDF · 3/3 held
models invisible and absent from the sitemap · 0 prices exposed · 0 supplier
references on any public page or PDF · 0 accessibility issues · 0 mobile
overflow · every page has a conversion path · all filter combinations correct ·
board 19/19 green.
