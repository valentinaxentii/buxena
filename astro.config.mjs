// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// NOTE: `site` must match the live domain for canonical URLs, sitemap and
// Open Graph tags to be correct. Update if the production domain changes.
export default defineConfig({
  site: 'https://buxena.com',
  integrations: [
    sitemap({
      // Keep noindex pages out of the sitemap — submitting a URL you also tell
      // Google not to index is a contradictory signal.
      filter: (page) =>
        !['/thank-you/', '/privacy/', '/terms/'].some((p) => page.endsWith(p)),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
