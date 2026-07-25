// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';

// NOTE: `site` must match the live domain for canonical URLs, sitemap and
// Open Graph tags to be correct. Update if the production domain changes.
export default defineConfig({
  site: 'https://buxena.com',
  // Default `output: 'static'` prerenders every page (the entire public
  // site keeps building exactly as before — zero change to its bundle or
  // hosting). Only /login and /admin/* opt out via `export const prerender
  // = false`, so just those routes render on-demand through a Netlify
  // Function. No admin code, no Supabase client, ships in the public bundle.
  adapter: netlify(),
  integrations: [
    sitemap({
      // Keep noindex pages out of the sitemap — submitting a URL you also tell
      // Google not to index is a contradictory signal. /collections/ is the
      // legacy category route, superseded by /saunas/*-saunas/. /admin and
      // /login are private and must never be indexed or listed.
      filter: (page) =>
        !['/thank-you/'].some((p) => page.endsWith(p)) &&
        !page.includes('/collections/') &&
        !page.includes('/admin') &&
        !page.includes('/login'),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  // Vite dev-server-only option — has no effect on `astro build` output, so
  // production is unaffected. Lets the Cloudflare Quick Tunnel hostname reach
  // the local dev server during preview/testing.
  vite: {
    server: {
      allowedHosts: ['.trycloudflare.com'],
    },
  },
});
