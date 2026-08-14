/**
 * Real-browser QA across every public route, at every width that matters.
 *
 * WHY THIS EXISTS
 * ---------------
 * `runtime-routes.mjs` proves each route RESPONDS. It says nothing about
 * whether the page is usable once laid out. The 2026-08-13 compression pass
 * changed spacing and heading sizes site-wide, and the class of damage that
 * causes — a heading that now overflows, a sticky bar that now covers the
 * primary CTA, a card that no longer matches its neighbours — is invisible to
 * an HTTP check and invisible to `astro check`. It only exists after layout.
 *
 * So this drives a real headless Chromium over the full public route set and
 * asserts things a customer would notice.
 *
 * WHAT IT CHECKS, and why each one earned its place
 *   overflow        an element wider than the viewport = sideways scrolling
 *   brokenImage     naturalWidth === 0 means the browser failed to decode it,
 *                   which is exactly how the EDA alt-text bug presented
 *   stickyCover     a fixed bar sitting on top of the primary CTA
 *   underHeader     content hidden beneath the sticky header
 *   tapTarget       interactive elements below 44px on touch widths
 *   emptySection    a rendered <section> with no text and no image
 *   clippedText     overflow:hidden cutting a heading mid-word
 *   cardUneven      product cards in one row differing wildly in height
 *   contrastish     obvious invisible text (same colour as its background)
 *
 * Findings are DEDUPED across widths so one broken component reports once with
 * the widths it affects, rather than five near-identical lines.
 *
 *   node scripts/browser-qa.mjs                    # all routes, all widths
 *   node scripts/browser-qa.mjs --widths 390       # one width
 *   node scripts/browser-qa.mjs --routes /saunas/  # one route
 *   node scripts/browser-qa.mjs --json out.json
 *
 * Requires the dev server: npm run dev
 */
import { chromium } from 'playwright';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BUXENA_BASE ?? 'http://localhost:4321';
const argv = process.argv.slice(2);
const flag = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);

const ALL_WIDTHS = [
  { name: '1440', width: 1440, height: 900, touch: false },
  { name: '1280', width: 1280, height: 800, touch: false },
  { name: '1024', width: 1024, height: 768, touch: false },
  { name: '430', width: 430, height: 932, touch: true },
  { name: '390', width: 390, height: 844, touch: true },
];

const widthFilter = flag('--widths');
const WIDTHS = widthFilter
  ? ALL_WIDTHS.filter((w) => widthFilter.split(',').includes(w.name))
  : ALL_WIDTHS;

// Product routes come from content, so a new model is covered the day it lands.
const contentDir = path.join(process.cwd(), 'src', 'content', 'saunas');
const productRoutes = readdirSync(contentDir)
  .filter((f) => f.endsWith('.md'))
  .filter((f) => {
    const raw = readFileSync(path.join(contentDir, f), 'utf8');
    return !/^draft:\s*true/m.test(raw) && !/^hold:\s*\S/m.test(raw);
  })
  .map((f) => `/saunas/${f.replace(/\.md$/, '')}/`);

const STATIC_ROUTES = [
  '/', '/saunas/', '/saunas/barrel-saunas/', '/saunas/cube-saunas/',
  '/saunas/indoor-saunas/', '/saunas/outdoor-saunas/',
  '/collections/barrel/', '/collections/cube/', '/collections/indoor/',
  '/compare/', '/plan-your-sauna/', '/see-it-in-my-space/', '/my-project/',
  '/start-your-project/', '/quote/', '/consultation/', '/for-trade/',
  '/how-buying-works/', '/heater-guide/', '/thank-you/', '/contact/', '/faq/',
  '/warranty/', '/shipping/', '/returns/', '/our-story/', '/wellness/',
  '/privacy/', '/terms/', '/accessibility/',
];

const routeFilter = flag('--routes');
const ROUTES = routeFilter
  ? routeFilter.split(',')
  : [...STATIC_ROUTES, ...productRoutes];

/** Runs inside the page. Returns plain data only. */
function auditPage() {
  const out = [];
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const add = (kind, detail, el) => {
    let where = '';
    if (el && el.tagName) {
      const cls = typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      where = el.tagName.toLowerCase() + cls;
    }
    out.push({ kind, detail, where });
  };

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // --- horizontal overflow -------------------------------------------------
  if (doc.scrollWidth > vw + 1) {
    add('overflow', `document scrollWidth ${doc.scrollWidth} > viewport ${vw}`, null);
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    if (s.position === 'fixed') continue;
    if (s.overflowX === 'auto' || s.overflowX === 'scroll') continue;
    const r = el.getBoundingClientRect();
    // Elements parked ENTIRELY off-screen to the left are deliberate, not
    // broken: the skip-link (a11y) and the form honeypots (spam traps) both
    // live at left:-9999px. Flagging them as overflow buried the one real
    // finding under five fake ones. Only left-overflow that is PARTIALLY
    // visible is a genuine layout fault.
    const parkedOffscreen = r.right <= 0;
    if (parkedOffscreen) continue;
    // An element clipped by an overflow:hidden ancestor cannot cause page
    // scrolling however wide it is. The homepage hero image deliberately
    // scales past its frame (ken-burns drift) inside a clipping section, and
    // reporting it as overflow was noise: document scrollWidth stayed at the
    // viewport, which is the fact that matters.
    let clipped = false;
    for (let anc = el.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
      const as = getComputedStyle(anc);
      if (as.overflow === 'hidden' || as.overflowX === 'hidden' || as.overflowX === 'clip') { clipped = true; break; }
    }
    if (clipped) continue;
    if (r.right > vw + 1 || r.left < -1) {
      // Report the OUTERMOST offender; children inherit the problem.
      const parent = el.parentElement;
      if (parent) {
        const pr = parent.getBoundingClientRect();
        if ((pr.right > vw + 1 || pr.left < -1) && pr.right > 0) continue;
      }
      add('overflow', `element extends to ${Math.round(r.right)}px (viewport ${vw})`, el);
    }
  }

  // --- broken images -------------------------------------------------------
  for (const img of document.querySelectorAll('img')) {
    if (!img.complete) continue;
    if (img.naturalWidth === 0) {
      add('brokenImage', `failed to decode: ${img.getAttribute('src') || '(no src)'}`, img);
    }
    const src = img.getAttribute('src');
    if (src !== null && src.trim() === '') {
      add('brokenImage', 'empty src attribute', img);
    }
  }

  // --- content hidden under the sticky header ------------------------------
  const header = document.querySelector('header');
  if (header && getComputedStyle(header).position === 'sticky') {
    const hb = header.getBoundingClientRect().bottom;
    const h1 = document.querySelector('h1');
    if (h1 && visible(h1)) {
      const r = h1.getBoundingClientRect();
      if (r.top < hb - 2 && r.bottom > 0) {
        add('underHeader', `h1 top ${Math.round(r.top)} is under header bottom ${Math.round(hb)}`, h1);
      }
    }
  }

  // --- fixed/sticky bars covering the primary CTA --------------------------
  const bars = [...document.querySelectorAll('body *')].filter((el) => {
    const s = getComputedStyle(el);
    return s.position === 'fixed' && visible(el) && el.getBoundingClientRect().height < 200;
  });
  for (const bar of bars) {
    const br = bar.getBoundingClientRect();
    if (br.top < window.innerHeight * 0.4) continue; // top bars are navigation
    for (const cta of document.querySelectorAll('a.btn, button.btn')) {
      if (!visible(cta)) continue;
      const cr = cta.getBoundingClientRect();
      if (cr.bottom < 0 || cr.top > window.innerHeight) continue;
      const overlaps = cr.top < br.bottom && cr.bottom > br.top && cr.left < br.right && cr.right > br.left;
      if (overlaps) {
        add('stickyCover', `fixed bar overlaps CTA "${(cta.textContent || '').trim().slice(0, 30)}"`, bar);
        break;
      }
    }
  }

  // --- tap targets (touch widths only; caller filters) ---------------------
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea')) {
    if (!visible(el)) continue;
    // Honeypots are hidden spam traps, deliberately unreachable — and
    // tabindex="-1" says so explicitly.
    if (el.getAttribute('tabindex') === '-1') continue;
    if (el.closest('[class*="__hp"], [hidden]')) continue;
    // Inline TEXT links — in a paragraph, list item or table cell — are read
    // and tapped as text, not as buttons. The 44px guidance is about discrete
    // controls; applying it to every link in a comparison table produced
    // twenty findings and no actionable defect.
    if (el.tagName === 'A' && el.closest('p, li, td, th, dd, dt')) continue;
    // A small control inside a LABEL is tapped via the label: the whole
    // .cfg__option row activates its 13px radio, and the styled upload
    // dropzone activates its visually-hidden file input. Judge the label.
    const owningLabel = el.closest('label');
    if (owningLabel && owningLabel !== el) {
      const lr = owningLabel.getBoundingClientRect();
      if (lr.height >= 30) continue;
    }
    const r = el.getBoundingClientRect();
    if (r.height < 30 || (r.width < 30 && r.height < 44)) {
      add('tapTarget', `${Math.round(r.width)}×${Math.round(r.height)}px — "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}"`, el);
    }
  }

  // --- clipped text --------------------------------------------------------
  for (const el of document.querySelectorAll('h1, h2, h3, .display, .btn')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    if (s.overflow === 'hidden' || s.overflowY === 'hidden') {
      if (el.scrollHeight > el.clientHeight + 3) {
        add('clippedText', `text clipped: "${(el.textContent || '').trim().slice(0, 34)}"`, el);
      }
    }
    if (el.scrollWidth > el.clientWidth + 3 && s.overflowX === 'hidden') {
      add('clippedText', `text clipped horizontally: "${(el.textContent || '').trim().slice(0, 34)}"`, el);
    }
  }

  // --- empty sections ------------------------------------------------------
  for (const sec of document.querySelectorAll('section')) {
    if (!visible(sec)) continue;
    const text = (sec.textContent || '').trim();
    const hasMedia = sec.querySelector('img, svg, video, canvas, [role="img"]');
    const r = sec.getBoundingClientRect();
    if (!text && !hasMedia && r.height > 40) {
      add('emptySection', `renders ${Math.round(r.height)}px with no text or media`, sec);
    }
  }

  // --- uneven cards in the same row ---------------------------------------
  const cardGroups = new Map();
  for (const card of document.querySelectorAll('.pcard, .plan-card, .space-card')) {
    if (!visible(card)) continue;
    const r = card.getBoundingClientRect();
    const rowKey = Math.round((r.top + window.scrollY) / 12);
    if (!cardGroups.has(rowKey)) cardGroups.set(rowKey, []);
    cardGroups.get(rowKey).push(Math.round(r.height));
  }
  for (const [, heights] of cardGroups) {
    if (heights.length < 2) continue;
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    if (max - min > 90) {
      add('cardUneven', `cards in one row differ by ${max - min}px (${min}–${max})`, null);
    }
  }

  // --- text the same colour as its own background --------------------------
  for (const el of document.querySelectorAll('h1, h2, h3, p, a, span, li')) {
    if (!visible(el)) continue;
    if (!(el.textContent || '').trim()) continue;
    // Screen-reader-only text is meant to be invisible.
    if (el.closest('.sr-only, .visually-hidden')) continue;
    // An OVERLAY header sits on top of hero media, so its cream text is read
    // against a photograph this walk cannot see. Verified on the homepage: at
    // scroll-top the header is transparent with cream nav over the dark hero,
    // and once stuck it flips to a cream ground with ink text. Correct in both
    // states — but naive ancestor-walking resolves the background to <body>
    // and reports eight invisible links that are not invisible.
    const overlayHost = el.closest('header, [class*="--over"], [class*="hero"]');
    if (overlayHost && getComputedStyle(overlayHost).backgroundColor === 'rgba(0, 0, 0, 0)') continue;
    const s = getComputedStyle(el);
    let bgEl = el;
    let bg = s.backgroundColor;
    let sawImage = false;
    while (bgEl && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
      if (getComputedStyle(bgEl).backgroundImage !== 'none') { sawImage = true; break; }
      bgEl = bgEl.parentElement;
      if (!bgEl) break;
      bg = getComputedStyle(bgEl).backgroundColor;
    }
    if (sawImage) continue; // text over artwork — not decidable this way
    if (bg && bg === s.color) {
      add('contrastish', `text colour equals background (${bg})`, el);
    }
  }

  return out;
}

const browser = await chromium.launch();
/** key -> { kind, detail, where, route, widths:Set } */
const findings = new Map();
let checked = 0;
const navFailures = [];

for (const vp of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    hasTouch: vp.touch,
    isMobile: vp.touch,
  });
  const page = await context.newPage();

  for (const route of ROUTES) {
    let res;
    try {
      res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    } catch (e) {
      navFailures.push(`${route} [${vp.name}] ${e.message.slice(0, 70)}`);
      continue;
    }
    if (!res || res.status() !== 200) {
      navFailures.push(`${route} [${vp.name}] HTTP ${res?.status()}`);
      continue;
    }
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(180);
    checked++;

    let results = [];
    try {
      results = await page.evaluate(auditPage);
    } catch (e) {
      navFailures.push(`${route} [${vp.name}] audit threw: ${e.message.slice(0, 70)}`);
      continue;
    }

    for (const f of results) {
      // Tap-target findings only mean something on a touch viewport.
      if (f.kind === 'tapTarget' && !vp.touch) continue;
      const key = `${route}|${f.kind}|${f.where}|${f.detail.replace(/\d+/g, '#')}`;
      if (!findings.has(key)) {
        findings.set(key, { ...f, route, widths: new Set() });
      }
      findings.get(key).widths.add(vp.name);
    }
  }
  await context.close();
}
await browser.close();

// --- report ------------------------------------------------------------------
const all = [...findings.values()];
const byKind = new Map();
for (const f of all) {
  if (!byKind.has(f.kind)) byKind.set(f.kind, []);
  byKind.get(f.kind).push(f);
}

const SEVERITY = ['overflow', 'brokenImage', 'stickyCover', 'underHeader', 'clippedText', 'emptySection', 'cardUneven', 'contrastish', 'tapTarget'];

console.log(`Browser QA — ${ROUTES.length} routes × ${WIDTHS.length} widths = ${checked} page loads\n`);

if (navFailures.length) {
  console.log(`NAVIGATION FAILURES: ${navFailures.length}`);
  for (const f of navFailures.slice(0, 20)) console.log(`  ✗ ${f}`);
  console.log('');
}

let total = 0;
for (const kind of SEVERITY) {
  const list = byKind.get(kind);
  if (!list?.length) continue;
  total += list.length;
  console.log(`${kind.toUpperCase()} — ${list.length}`);
  // Group identical problems appearing on many routes.
  const grouped = new Map();
  for (const f of list) {
    const g = `${f.where}|${f.detail.replace(/\d+/g, '#')}`;
    if (!grouped.has(g)) grouped.set(g, { ...f, routes: [] });
    grouped.get(g).routes.push(f.route);
  }
  for (const g of [...grouped.values()].sort((a, b) => b.routes.length - a.routes.length).slice(0, 12)) {
    const w = [...g.widths].join(',');
    const r = g.routes.length > 3
      ? `${g.routes.slice(0, 3).join(', ')} +${g.routes.length - 3} more`
      : g.routes.join(', ');
    console.log(`  · ${g.where || '(document)'} — ${g.detail}`);
    console.log(`      widths ${w} · ${r}`);
  }
  console.log('');
}

if (flag('--json')) {
  writeFileSync(flag('--json'), JSON.stringify(all.map((f) => ({ ...f, widths: [...f.widths] })), null, 2));
}

console.log(`TOTAL FINDINGS: ${total}`);
if (navFailures.length || total > 0) process.exitCode = 1;
else console.log('clean at every width');
