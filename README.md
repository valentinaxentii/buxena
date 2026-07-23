# BUXENA

Marketing site for BUXENA — *Where Wellness Starts*. Premium European-designed
saunas selected for American homes.

Built with [Astro](https://astro.build). Static output, no backend.

---

## Running it

Requires Node 20 or newer.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to dist/
npm run preview  # serve the built site locally
```

---

## Development vs production

This is the most important thing to understand about the codebase.

The site has two modes, switched automatically by `import.meta.env.DEV`
(exported as `showDev` from `src/data/site.ts`).

| | `npm run dev` | `npm run build` |
|---|---|---|
| Placeholder image labels + art direction | shown | silent tone block |
| "Placeholder listing" badge | shown | removed |
| Unverified specifications | "To be confirmed" | omitted entirely |
| Empty Materials / Heaters / Features | shown as pending | section removed |
| Specs sidebar with nothing verified | shown | hidden, description full width |
| Unanswered FAQ questions | shown | removed from page and schema |
| Unconfirmed email address | shown | hidden everywhere |
| Privacy / Terms footer links | shown | hidden |

**Customers never see incomplete information. You always do while working.**

Nothing needs un-hiding later. Fill in a real value and it appears in
production automatically.

---

## Adding a sauna

Create one Markdown file in `src/content/saunas/`. The filename becomes the URL.

```yaml
---
title: "Nordic 200"
category: "outdoor"        # outdoor | indoor | barrel | cube | heaters | accessories
tagline: "Short line under the name"
summary: "One sentence for cards and search results."
order: 10                  # controls sort position
placeholder: false         # set false once facts are verified
heroImage:
  src: "/images/nordic-200-hero.jpg"
  alt: "Nordic 200 outdoor sauna"
gallery:
  - src: "/images/nordic-200-interior.jpg"
    alt: "Interior looking toward the bench"

# Everything below is OPTIONAL. Omit anything unverified — do not guess.
capacity: "Seats 4"
dimensions:
  - { label: "Width", value: "78 in" }
materials: ["Nordic spruce"]
heaterOptions: ["Electric 6kW"]
features: ["Two-tier benching"]
downloads:
  - { label: "Specification sheet", file: "/downloads/nordic-200.pdf" }
---

Body copy in Markdown.
```

The model then appears automatically in the range, its collection page, the
filter chips, the quote form dropdown, and the sitemap.

**Categories create themselves.** Heaters and Accessories are defined in
`src/data/site.ts` but generate no pages until a product uses them. Add one
heater and its collection page, footer link and filter chip all appear.

---

## Adding images

Drop files in `public/images/` and reference them as `/images/filename.jpg`.
See `public/images/README.md` for the art-direction notes — every placeholder
carries a description of the shot it stands in for.

Only use photography you own or have licensed.

---

## Before launch

1. **Confirm the email address.** `hello@buxena.com` in `src/data/site.ts` is
   unverified and hidden from production. Once the mailbox exists, set
   `emailConfirmed: true`.
2. **Write Privacy and Terms.** `src/pages/privacy.astro` and `terms.astro` are
   stubs; footer links are hidden until real text is in place. Have these
   reviewed against US consumer and privacy law — state requirements vary.
3. **Replace the placeholder listings.** Four generic entries stand in for real
   supplier models.
4. **Check `site` in `astro.config.mjs`** matches the production domain.
   Canonical URLs, sitemap and Open Graph tags depend on it.

---

## Deploying

Netlify, from `netlify.toml`: build `npm run build`, publish `dist`.

The quote form uses **Netlify Forms** — no backend. Submissions appear under
Forms in the Netlify dashboard once the site is deployed. Turn on email
notifications there so enquiries do not sit unread.

---

## Structure

```
src/
  content/saunas/     one Markdown file per model
  content.config.ts   schema — all spec fields optional by design
  data/site.ts        nav, categories, contact, dev/prod switch
  components/         Header, Footer, Hero, Figure, cards, QuoteForm
  layouts/            BaseLayout — SEO, fonts, structured data
  pages/              routes
  styles/global.css   design tokens and shared styles
public/               static assets, robots.txt
```
