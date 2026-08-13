/**
 * Real rendered page heights, desktop and mobile, plus layout-damage checks.
 *
 * WHY THIS EXISTS
 * ---------------
 * The founder asked for a ~25–30% reduction in vertical page length and, quite
 * reasonably, for EVIDENCE that it happened — with the explicit instruction not
 * to fabricate measurements if a browser was unavailable.页面 height is a
 * layout property: it cannot be derived from the CSS source, only measured
 * after layout. So this drives a real headless Chromium.
 *
 * It also guards the risk that compression itself introduces: squeezing
 * vertical space can push content sideways. Every page is checked for
 * horizontal overflow at both widths, which is the failure that would otherwise
 * be found by a customer on a phone.
 *
 *   node scripts/measure-pages.mjs                       # measure, print table
 *   node scripts/measure-pages.mjs --save before.json    # record a baseline
 *   node scripts/measure-pages.mjs --compare before.json # before → after → %
 *
 * Requires the dev server: npm run dev
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.BUXENA_BASE ?? 'http://localhost:4321';

const args = process.argv.slice(2);
// `indexOf` returns -1 when --save is absent, so `args[-1 + 1]` is args[0] —
// which meant `--compare before.json` silently wrote a baseline to a file
// literally named "--compare". Guard the flag's presence, not its index.
const saveTo = args.includes('--save') ? args[args.indexOf('--save') + 1] : null;
const compareTo = args.includes('--compare') ? args[args.indexOf('--compare') + 1] : null;

/** The pages the founder named, plus the funnel pages that matter commercially. */
const PAGES = [
  ['homepage', '/'],
  ['saunas catalogue', '/saunas/'],
  ['product page', '/saunas/viru-thermowood-4-0m/'],
  ['request pricing', '/quote/'],
  ['sauna advisor', '/plan-your-sauna/'],
  ['heater guide', '/heater-guide/'],
  ['compare', '/compare/'],
  ['for trade', '/for-trade/'],
  ['our story', '/our-story/'],
  ['contact', '/contact/'],
  ['wellness', '/wellness/'],
  ['how buying works', '/how-buying-works/'],
  ['faq', '/faq/'],
  ['see it in my space', '/see-it-in-my-space/'],
  ['start your project', '/start-your-project/'],
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();
const results = {};
const problems = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const [label, route] of PAGES) {
    const url = BASE + route;
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    } catch (e) {
      problems.push(`${label} [${vp.name}] — navigation failed: ${e.message.slice(0, 90)}`);
      continue;
    }
    if (!response || response.status() !== 200) {
      problems.push(`${label} [${vp.name}] — HTTP ${response?.status()}`);
      continue;
    }

    // Fonts change line-box heights, so a measurement taken before they load is
    // not the height a visitor sees.
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(250);

    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      // Elements wider than the viewport = sideways scrolling on a phone.
      const overflowing = [];
      const vw = doc.clientWidth;
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const style = getComputedStyle(el);
        if (style.position === 'fixed') continue;
        // Allow a 1px rounding tolerance.
        if (r.right > vw + 1 || r.left < -1) {
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;
          overflowing.push(
            `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`
          );
        }
      }
      const header = document.querySelector('header');
      return {
        height: Math.round(doc.scrollHeight),
        docScrollWidth: Math.round(doc.scrollWidth),
        clientWidth: vw,
        headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
        overflow: [...new Set(overflowing)].slice(0, 6),
      };
    });

    results[`${label}|${vp.name}`] = m;

    if (m.docScrollWidth > m.clientWidth + 1) {
      problems.push(
        `${label} [${vp.name}] — HORIZONTAL OVERFLOW: document ${m.docScrollWidth}px > viewport ${m.clientWidth}px` +
          (m.overflow.length ? ` (${m.overflow.join(', ')})` : '')
      );
    }
  }
  await context.close();
}
await browser.close();

// --- output ------------------------------------------------------------------
if (saveTo) {
  writeFileSync(saveTo, JSON.stringify(results, null, 2));
  console.log(`baseline written to ${saveTo}\n`);
}

const before = compareTo ? JSON.parse(readFileSync(compareTo, 'utf8')) : null;

for (const vp of VIEWPORTS) {
  console.log(`\n${vp.name.toUpperCase()} (${vp.width}×${vp.height})`);
  if (before) {
    console.log('  page                      before    after     change');
    console.log('  ' + '-'.repeat(54));
  } else {
    console.log('  page                      height    header');
    console.log('  ' + '-'.repeat(44));
  }

  let totalBefore = 0;
  let totalAfter = 0;

  for (const [label] of PAGES) {
    const key = `${label}|${vp.name}`;
    const now = results[key];
    if (!now) {
      console.log(`  ${label.padEnd(24)} — not measured`);
      continue;
    }
    if (before && before[key]) {
      const b = before[key].height;
      const a = now.height;
      totalBefore += b;
      totalAfter += a;
      const pct = b === 0 ? 0 : ((a - b) / b) * 100;
      const sign = pct <= 0 ? '' : '+';
      console.log(
        `  ${label.padEnd(24)} ${String(b).padStart(6)}  ${String(a).padStart(6)}   ${sign}${pct.toFixed(1)}%`
      );
    } else {
      console.log(
        `  ${label.padEnd(24)} ${String(now.height).padStart(6)}    ${String(now.headerHeight ?? '—').padStart(5)}`
      );
    }
  }

  if (before && totalBefore > 0) {
    const pct = ((totalAfter - totalBefore) / totalBefore) * 100;
    console.log('  ' + '-'.repeat(54));
    console.log(
      `  ${'TOTAL'.padEnd(24)} ${String(totalBefore).padStart(6)}  ${String(totalAfter).padStart(6)}   ${pct <= 0 ? '' : '+'}${pct.toFixed(1)}%`
    );
  }
}

// Report BOTH headers. The homepage is excluded from the compression pass, so
// quoting its header as "the header height" would have hidden the fact that
// every other page's header did change — the first run of this script did
// exactly that and reported a flat 88px.
for (const vp of VIEWPORTS) {
  const home = results[`homepage|${vp.name}`]?.headerHeight;
  const other = results[`our story|${vp.name}`]?.headerHeight;
  if (home || other) {
    console.log(`\nheader (${vp.name}): homepage ${home}px · non-home ${other}px`);
  }
}

if (problems.length) {
  console.log(`\nLAYOUT PROBLEMS: ${problems.length}`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
} else {
  console.log('\nno horizontal overflow at either width');
}
