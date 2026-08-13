import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const checks = [];
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });

const quote = read('src/components/QuoteForm.astro');
const thankYou = read('src/pages/thank-you.astro');
const tracking = read('src/lib/track.ts');
const layout = read('src/layouts/BaseLayout.astro');
const env = read('.env.example');

check('lead_confirmed event exists', tracking.includes("| 'lead_confirmed'"));
check('quote step 1 counts durable lead', quote.includes("track('lead_confirmed', leadPayload)"));
check('quote summary marks conversion already counted', quote.includes("conversionTracked: 'true'"));
check('thank-you suppresses duplicate quote conversion', thankYou.includes("s.conversionTracked !== 'true'"));
check('direct thank-you visits are not leads', thankYou.includes("track('thank_you_direct_visit'"));
check('GTM is opt-in, not hard-coded', layout.includes('PUBLIC_GTM_ID') && layout.includes("/^GTM-[A-Z0-9]+$/i"));
check('Search Console verification is opt-in', layout.includes('PUBLIC_GOOGLE_SITE_VERIFICATION'));
check('analytics env vars are documented', env.includes('PUBLIC_GTM_ID=') && env.includes('PUBLIC_GOOGLE_SITE_VERIFICATION='));

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}`);
const failed = checks.filter((x) => !x.ok);
if (failed.length) {
  console.error(`\nSales funnel audit failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`\nSales funnel audit passed: ${checks.length}/${checks.length}.`);
