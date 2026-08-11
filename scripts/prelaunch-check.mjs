/**
 * BUXENA V2 — pre-launch smoke test.
 *
 *   node scripts/prelaunch-check.mjs             full run (build + all checks)
 *   node scripts/prelaunch-check.mjs --skip-build  reuse the existing dist/
 *
 * One command that re-runs every launch-readiness check developed during the
 * V2 build, and ends with a single PASS/FAIL board:
 *
 *   1. Production build compiles
 *   2. Every expected public route was generated
 *   3. Zero broken internal links, images, or optimized-image variants
 *   4. Every public page has a title + meta description
 *   5. Sitemap exists, lists sales pages, excludes admin/login/thank-you
 *   6. NO unapproved price appears on any public page (quote-form budget
 *      ranges inside <select> are the one allowed exception)
 *   7. All lead forms accept a dev-mode submission (nothing sent anywhere);
 *      honeypot swallowed; customer-ack + suggested-reply modules behave
 *      (send/skip decisions, mailto encoding)
 *
 * SAFETY: read-only against the repo; never touches production. If .env
 * opts into live services (ENQUIRIES_DEV_LIVE=true) the form-submission
 * tests are SKIPPED entirely rather than risk writing a real row.
 * Exit code: 0 = launch-green, 1 = at least one failure.
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SKIP_BUILD = process.argv.includes('--skip-build');
const results = [];
const record = (section, name, ok, detail = '') => {
  results.push({ section, name, ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// ---------------------------------------------------------------- 1. build
console.log('\n■ 1/7 Production build');
if (SKIP_BUILD) {
  record('build', 'build skipped (--skip-build), dist/ reused', existsSync(DIST), existsSync(DIST) ? '' : 'dist/ missing');
} else {
  try {
    execSync('npm run build', { stdio: 'pipe', timeout: 300_000 });
    record('build', 'astro build completes', true);
  } catch (e) {
    record('build', 'astro build completes', false, String(e.stdout ?? e).slice(-400));
  }
}

const htmls = [];
if (existsSync(DIST)) {
  (function walk(d) {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.html')) htmls.push(p);
    }
  })(DIST);
}

// ---------------------------------------------------------------- 2. routes
console.log('\n■ 2/7 Expected public routes');
const MUST_EXIST = [
  'index.html', '404.html',
  'saunas/index.html', 'saunas/ella-h2/index.html', 'saunas/uku-160/index.html', 'saunas/uku-230/index.html',
  'saunas/barrel-saunas/index.html', 'saunas/cube-saunas/index.html', 'saunas/indoor-saunas/index.html', 'saunas/outdoor-saunas/index.html',
  'compare/index.html', 'plan-your-sauna/index.html', 'see-it-in-my-space/index.html', 'how-buying-works/index.html',
  'quote/index.html', 'consultation/index.html', 'for-trade/index.html', 'start-your-project/index.html', 'my-project/index.html',
  'thank-you/index.html', 'contact/index.html', 'faq/index.html', 'warranty/index.html', 'shipping/index.html', 'returns/index.html',
  'our-story/index.html', 'wellness/index.html', 'privacy/index.html', 'terms/index.html', 'accessibility/index.html',
];
const missingRoutes = MUST_EXIST.filter((r) => !existsSync(path.join(DIST, r)));
record('routes', `all ${MUST_EXIST.length} key routes generated (${htmls.length} pages total)`, missingRoutes.length === 0, missingRoutes.join(', '));
const saunaPages = htmls.filter((h) => /saunas[\\/](?!index|barrel|cube|indoor|outdoor)[^\\/]+[\\/]index\.html$/.test(h)).length;
record('routes', `product pages generated (${saunaPages})`, saunaPages >= 30, saunaPages < 30 ? 'expected 30+' : '');

// ------------------------------------------------- 3. links, images, variants
console.log('\n■ 3/7 Internal links, images, optimized variants');
const dynamicOk = (u) => u.startsWith('/api/') || u.startsWith('/admin') || u.startsWith('/login') || u.startsWith('/unit/') || u.includes('${');
const broken = new Set();
let checked = 0;
const unoptimized = new Set();
for (const h of htmls) {
  const html = readFileSync(h, 'utf8');
  const urls = [...html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)].map((m) => m[1]);
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) for (const part of m[1].split(',')) urls.push(part.trim().split(' ')[0]);
  for (const u of new Set(urls)) {
    if (dynamicOk(u) || !u.startsWith('/')) continue;
    checked++;
    const clean = decodeURIComponent(u);
    const cands = [path.join(DIST, clean), path.join(DIST, clean, 'index.html'), path.join(DIST, clean.replace(/\/$/, '') + '.html')];
    if (!cands.some((c) => existsSync(c))) broken.add(`${u} ← ${path.relative(DIST, h)}`);
    // Content images should have at least one optimized variant available.
    if (/^\/images\/.*\.(jpe?g|png)$/i.test(clean) && !clean.includes('og-brand-card')) {
      const noExt = clean.slice(1, clean.lastIndexOf('.'));
      if (![480, 960, 1600].some((w) => existsSync(path.join(DIST, '_optimized', `${noExt}-${w}.webp`)))) unoptimized.add(clean);
    }
  }
}
record('links', `no broken internal links (${checked} refs checked)`, broken.size === 0, [...broken].slice(0, 5).join(' | '));
record('links', 'every content image has an optimized variant', unoptimized.size === 0, unoptimized.size ? `${unoptimized.size} image(s): ${[...unoptimized].slice(0, 3).join(', ')} — run scripts/optimize-images.mjs` : '');

// ---------------------------------------------------------------- 4. SEO meta
console.log('\n■ 4/7 Titles and meta descriptions');
const metaFails = [];
for (const h of htmls) {
  const html = readFileSync(h, 'utf8');
  if (!/<title>[^<]+<\/title>/.test(html) || !/<meta name="description" content="[^"]+"/.test(html)) {
    metaFails.push(path.relative(DIST, h));
  }
}
record('seo', `every page has title + description (${htmls.length} pages)`, metaFails.length === 0, metaFails.slice(0, 5).join(', '));

// ---------------------------------------------------------------- 5. sitemap
console.log('\n■ 5/7 Sitemap and robots');
const smIndex = path.join(DIST, 'sitemap-index.xml');
const sm0 = path.join(DIST, 'sitemap-0.xml');
record('sitemap', 'sitemap-index.xml generated', existsSync(smIndex));
if (existsSync(sm0)) {
  const sm = readFileSync(sm0, 'utf8');
  const wants = ['/saunas/ella-h2/', '/quote/', '/compare/', '/for-trade/'];
  const bans = ['/admin', '/login', '/thank-you/', '/collections/'];
  record('sitemap', 'sales pages listed', wants.every((w) => sm.includes(w)), wants.filter((w) => !sm.includes(w)).join(', '));
  record('sitemap', 'admin/login/thank-you/legacy excluded', bans.every((b) => !sm.includes(b)), bans.filter((b) => sm.includes(b)).join(', '));
}
const robots = path.join(ROOT, 'public', 'robots.txt');
record('sitemap', 'robots.txt disallows /admin and /login', existsSync(robots) && readFileSync(robots, 'utf8').includes('Disallow: /admin'));

// ------------------------------------------------------- 6. no-price freeze
console.log('\n■ 6/7 Pricing freeze — no unapproved price on any public page');
const priceHits = [];
for (const h of htmls) {
  // The quote form's budget dropdown is the single approved place dollar
  // ranges appear — strip all <select> blocks, then flag any price-like text.
  const html = readFileSync(h, 'utf8').replace(/<select[\s\S]*?<\/select>/g, '');
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '');
  const m = body.match(/From \$\d|\$\d{1,3},\d{3}|\$\d{4,}/);
  if (m) priceHits.push(`${path.relative(DIST, h)}: "${m[0]}"`);
}
record('pricing', 'zero price-like values outside the budget dropdown', priceHits.length === 0, priceHits.slice(0, 5).join(' | '));

// Central register: any published price must carry its approval trail.
try {
  const reg = await import(new URL('../src/data/pricing.ts', import.meta.url).href);
  const entries = Object.entries(reg.APPROVED_PRICES ?? {});
  const unsigned = entries.filter(([, v]) => !v.approvedBy || !v.approvedOn).map(([k]) => k);
  record(
    'pricing',
    entries.length === 0
      ? 'pricing register empty (freeze in effect)'
      : `all ${entries.length} published price(s) carry approvedBy + approvedOn`,
    unsigned.length === 0,
    unsigned.join(', ')
  );
} catch (e) {
  record('pricing', 'pricing register readable', false, String(e).slice(0, 120));
}

// ------------------------------------------------------ 7. forms + email libs
console.log('\n■ 7/7 Lead forms and email modules');

// Suggested-reply module — pure unit checks (dependency-free import).
try {
  const tpl = await import(new URL('../src/lib/enquiry-reply-templates.ts', import.meta.url).href);
  const reply = tpl.buildEnquiryReply({ name: 'Maria', saunaInterest: 'BUH-ELLA H2', location: '33139', source: 'Quote Form' });
  record('email', 'suggested reply renders (pricing template)', reply.templateName === 'Pricing request' && reply.body.includes('ELLA H2'));
  const href = tpl.buildMailtoHref('maria@test.local', reply);
  const params = new URLSearchParams(new URL(href).search);
  record('email', 'mailto round-trips subject/body exactly', params.get('subject') === reply.subject && params.get('body') === reply.body.replace(/\n/g, '\r\n'));
} catch (e) {
  record('email', 'suggested-reply unit checks', false, `import failed: ${String(e).slice(0, 120)}`);
}
// The customer-ack module can't be imported standalone (extension-less
// internal imports); it is verified END-TO-END below instead — the dev
// server's ack preview lines prove the real send/skip decisions.

// Live dev-server form tests — guarded against any live configuration.
const envFile = path.join(ROOT, '.env');
const devLive = existsSync(envFile) && /^\s*ENQUIRIES_DEV_LIVE\s*=\s*true\s*$/m.test(readFileSync(envFile, 'utf8'));
if (devLive) {
  record('forms', 'SKIPPED — .env has ENQUIRIES_DEV_LIVE=true (live mode); refusing to submit test forms', false, 'unset it and re-run');
} else {
  const base = 'http://localhost:4321';
  const up = async () => { try { return (await fetch(`${base}/`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } };
  let startedHere = false;
  if (!(await up())) {
    spawn('npm', ['run', 'dev'], { shell: true, detached: true, stdio: 'ignore' }).unref();
    startedHere = true;
    for (let i = 0; i < 20 && !(await up()); i++) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!(await up())) {
    record('forms', 'dev server reachable', false, 'could not start astro dev');
  } else {
    const post = (payload) =>
      fetch(`${base}/api/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    const devLogs = () => { try { return execSync('npx astro dev logs', { encoding: 'utf8', stdio: 'pipe' }); } catch { return ''; } };
    const logsBefore = devLogs().length;

    // One submission per source; enrichment ("— details") must NOT trigger a
    // customer acknowledgment, everything else with an email must.
    const SOURCES = ['Quote Form', 'Quote Form — details', 'Check Availability', 'Consultation Request', 'For Trade', 'Plan Your Sauna', 'See It In My Space', 'Project Intake', 'Quote Comparison', 'Sauna Advisor'];
    let allOk = true;
    const bad = [];
    for (const source of SOURCES) {
      const r = await post({ name: 'Smoke Test', email: 'smoke@test.local', message: 'prelaunch check', saunaInterest: 'BUH-ELLA H2', source });
      if (!(r.ok === true && r.devMode === true)) { allOk = false; bad.push(source); }
    }
    record('forms', `all ${SOURCES.length} form sources accepted in dev test mode (nothing sent/stored)`, allOk, bad.join(', '));

    // Customer-ack decisions, verified end-to-end from the dev server's own
    // preview log lines produced by the submissions above.
    const newLogs = devLogs().slice(logsBefore);
    const sends = (newLogs.match(/customer ack would send/g) ?? []).length;
    const skips = (newLogs.match(/customer ack would NOT send/g) ?? []).length;
    record('email', `customer ack sends for ${SOURCES.length - 1} sources, skips enrichment (saw ${sends} send / ${skips} skip)`, sends === SOURCES.length - 1 && skips === 1);
    const hp = await post({ name: 'Bot', email: 'bot@spam.local', message: 'spam', source: 'Quote Form', botField: 'filled' });
    record('forms', 'honeypot swallowed silently', hp.ok === true && hp.devMode === undefined);
    const pages = ['/', '/saunas/ella-h2', '/quote/?intent=compare&model=BUH-ELLA%20H2'];
    let pagesOk = true;
    for (const p of pages) { try { if (!(await fetch(base + p)).ok) pagesOk = false; } catch { pagesOk = false; } }
    record('forms', 'key journey pages respond on dev server', pagesOk);
    if (startedHere) { try { execSync('npx astro dev stop', { stdio: 'pipe' }); } catch { /* leave it running */ } }
  }
}

// ------------------------------------------------------------------- summary
const fails = results.filter((r) => !r.ok);
console.log('\n════════════════════════════════════════');
console.log(`PRE-LAUNCH BOARD: ${results.length - fails.length}/${results.length} checks passed`);
if (fails.length) {
  console.log('\nFailures:');
  for (const f of fails) console.log(`  ✗ [${f.section}] ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  console.log('\nRESULT: NOT LAUNCH-READY');
  process.exit(1);
}
console.log('RESULT: GREEN — all automated checks passed');
console.log('(Founder-side gates — pricing approval, image rights, env vars, hero image — are tracked in docs/, not here.)');
