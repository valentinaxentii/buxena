/**
 * Real rendered footer height, before/after, at desktop and mobile.
 *
 * One-off for the 2026-08-14 footer compression request — measures the
 * <footer> element itself (not the whole page), on Home and one non-home
 * page, since the change is now intentionally uniform between them.
 */
import { chromium } from 'playwright';

const BASE = process.env.BUXENA_BASE ?? 'http://localhost:4321';
const label = process.argv[2] ?? 'measurement';

const PAGES = [
  ['homepage', '/'],
  ['our story (non-home)', '/our-story/'],
];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();
console.log(`\n=== ${label} ===`);
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  for (const [name, route] of PAGES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(150);
    const h = await page.evaluate(() => {
      const f = document.querySelector('footer.ftr');
      return f ? Math.round(f.getBoundingClientRect().height) : null;
    });
    console.log(`  ${vp.name.padEnd(8)} ${name.padEnd(22)} footer height: ${h}px`);
  }
  await context.close();
}
await browser.close();
