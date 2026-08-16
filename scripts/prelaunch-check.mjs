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
  'saunas/index.html', 'saunas/bux-ella-h2/index.html', 'saunas/bux-uku-160/index.html', 'saunas/bux-uku-230/index.html',
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
  const wants = ['/saunas/bux-ella-h2/', '/quote/', '/compare/', '/for-trade/'];
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
    const pages = ['/', '/saunas/bux-ella-h2', '/quote/?intent=compare&model=BUH-ELLA%20H2'];
    let pagesOk = true;
    for (const p of pages) { try { if (!(await fetch(base + p)).ok) pagesOk = false; } catch { pagesOk = false; } }
    record('forms', 'key journey pages respond on dev server', pagesOk);
    if (startedHere) { try { execSync('npx astro dev stop', { stdio: 'pipe' }); } catch { /* leave it running */ } }
  }
}

// -------------------------------------- 7b. watermarked / blocked imagery
// Files known to carry a stock watermark must never reach production.
// Listed explicitly so removing either the file OR the reference clears it.
{
  const WATERMARKED = ['/images/collections/cube.png'];
  const used = WATERMARKED.filter((w) => htmls.some((h) => readFileSync(h, 'utf8').includes(w)));
  const detail = used.length
    ? 'PREVIEW-ONLY files still referenced: ' + used.join(', ') + ' — replace with a licensed file before production'
    : '';
  record('images', 'no watermarked image referenced on any page', used.length === 0, detail);
}

// ---------------------------------- 7c. every form source is writable to the DB
// The check the board did not have on 2026-08-13, when nine of the site's
// twelve enquiry sources could not be inserted at all: enquiries.source still
// carried its original five-value CHECK constraint. Every one of those leads
// fell back to the staff email and survived — but none reached the CRM.
//
// It cannot be caught by submitting forms, which is why "all 10 form sources
// accepted in dev test mode" passed throughout: `astro dev` short-circuits
// before Supabase, so no local submission ever meets the constraint. This is a
// static cross-check of the two files that have to agree — the forms that name
// a source, and the schema that decides what a source may be.
{
  const srcDir = path.join(ROOT, 'src');
  const sourceLiterals = new Set();
  (function walk(d) {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(astro|ts)$/.test(f)) {
        const text = readFileSync(p, 'utf8');
        // `source: 'X'` and the ternary form `source: cond ? 'X' : 'Y'`.
        for (const m of text.matchAll(/\bsource:\s*(?:[^,;{}\n]*?\?\s*)?'([^']+)'(?:\s*:\s*'([^']+)')?/g)) {
          for (const value of [m[1], m[2]]) {
            // Skip settings-vocabulary matches (warranty_start_source) and
            // anything that is plainly a variable rather than a form source.
            if (value && !/^(delivery_date|installation_date|invoice_date|manual)$/.test(value)) {
              sourceLiterals.add(value);
            }
          }
        }
      }
    }
  })(srcDir);

  const schemaText = readFileSync(path.join(ROOT, 'supabase', 'schema.sql'), 'utf8');
  // The LAST source constraint in the file wins — schema.sql deliberately
  // replaces the inline create-table constraint further down.
  const constraints = [...schemaText.matchAll(/check\s*\(\s*source\s+in\s*\(([^)]*)\)/gi)];
  const relaxed = /enquiries_source_check\s*\n?\s*check\s*\(source is not null/i.test(schemaText);

  let ok = true;
  let detail = '';
  if (relaxed) {
    detail = `${sourceLiterals.size} form sources, constraint accepts any non-empty value`;
  } else if (constraints.length) {
    const allowed = new Set(
      [...constraints[constraints.length - 1][1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    );
    const rejected = [...sourceLiterals].filter((s) => !allowed.has(s));
    ok = rejected.length === 0;
    detail = ok
      ? `${sourceLiterals.size} form sources all permitted`
      : `enquiries.source CHECK would REJECT ${rejected.length} of ${sourceLiterals.size}: ${rejected.join(', ')} — these leads never reach the CRM (apply supabase/migrations/2026-08-13-enquiry-source-constraint.sql)`;
  } else {
    ok = false;
    detail = 'could not find a source constraint in supabase/schema.sql to check against';
  }
  record('forms', 'every form source can be written to enquiries', ok, detail);
}

// ------------------------- 5b. noindex and the sitemap must agree
// Submitting a URL you also tell Google not to index is a contradictory
// signal, and the two lists live in different files — the page sets its own
// `noindex`, while astro.config.mjs filters the sitemap by URL and cannot see
// it. /my-project/ was in both for exactly that reason.
{
  const sitemapPath = path.join(DIST, 'sitemap-0.xml');
  if (!existsSync(sitemapPath)) {
    record('sitemap', 'noindex pages stay out of the sitemap', false, 'sitemap-0.xml missing');
  } else {
    const locs = new Set(
      [...readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    );
    const leaks = [];
    for (const file of htmls) {
      const text = readFileSync(file, 'utf8');
      if (!/content="noindex/.test(text)) continue;
      const rel = path.relative(DIST, file).split(path.sep).join('/');
      const url = 'https://buxena.com/' + rel.replace(/index\.html$/, '');
      if (locs.has(url)) leaks.push(url);
    }
    record(
      'sitemap',
      'noindex pages stay out of the sitemap',
      leaks.length === 0,
      leaks.length ? `also listed in sitemap: ${leaks.join(', ')} — add to the filter in astro.config.mjs` : ''
    );
  }
}

// -------------------------------- 7d. no raw JSON.stringify inside a <script>
// JSON.stringify does not escape `<`, so a stored value containing
// `</script>` closes the tag and the remainder is parsed as markup. Public
// enquiry names reach customers.name and are embedded this way on the
// new-invoice page — stored XSS in the admin panel, authored from a public
// form. Every payload goes through jsonForScript(); this is the rule's guard.
{
  const srcDir = path.join(ROOT, 'src');
  const offenders = [];
  (function walk(d) {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      // json-script.ts quotes the unsafe pattern in its own docstring to
      // explain what it prevents; matching that would fail the build forever.
      else if (/\.(astro|ts)$/.test(f) && f !== 'json-script.ts') {
        const text = readFileSync(p, 'utf8');
        if (/set:html=\{\s*JSON\.stringify\(/.test(text)) {
          offenders.push(path.relative(ROOT, p));
        }
      }
    }
  })(srcDir);
  record(
    'security',
    'no <script> payload bypasses the JSON escaper',
    offenders.length === 0,
    offenders.length ? `use jsonForScript() in: ${offenders.join(', ')}` : ''
  );
}

// -------------------------------------------- 7e. catalogue readiness
// Every PUBLISHED model, checked for the things a visitor would notice: a
// hero image that is missing from disk or has no alt text, a placeholder
// notice that would render, absent capacity/dimensions/materials/summary,
// a category that contradicts its own productType or location, and — the one
// that must never regress — a price or a non-preorder availability claim
// sitting in frontmatter.
{
  let out = '';
  let ok = false;
  try {
    out = execSync('node scripts/catalogue-readiness.mjs', { encoding: 'utf8' });
    ok = true;
  } catch (e) {
    out = String(e.stdout ?? e);
  }
  const summary = (out.match(/PUBLISHED MODELS: .*/) ?? ['?'])[0];
  const findings = out.includes('PER MODEL')
    ? out.split('PER MODEL (only those with findings)')[1]?.replace(/\s+/g, ' ').trim().slice(0, 260)
    : '';
  record('catalogue', summary.toLowerCase() || 'catalogue readiness', ok, ok ? '' : findings);
}

// ------------------------------- 7f. every public route, actually requested
// The check that was missing when /saunas/ threw a ReferenceError at runtime
// and shipped as "launch-ready". Static analysis of dist/ cannot see a page
// that fails to render, and the previous journey check hit a handful of
// routes rather than all 32 product pages. This asks a live server for every
// one of them.
{
  let out = '';
  let ok = false;
  try {
    out = execSync('node scripts/runtime-routes.mjs', { encoding: 'utf8', timeout: 300_000 });
    ok = /all routes rendered successfully/.test(out);
  } catch (e) {
    out = String(e.stdout ?? e);
  }
  const count = (out.match(/routes checked: (\d+)/) ?? [])[1] ?? '?';
  const detail = ok
    ? ''
    : (out.split('RUNTIME FAILURES:')[1] ?? out).replace(/\s+/g, ' ').trim().slice(0, 260);
  record('runtime', `all ${count} public routes render on a live server`, ok, detail);
}

// ------------------------------------------- 8. model presentation system
console.log('\n■ 8/8 Model presentations');
{
  let out = '';
  let ok = false;
  try {
    out = execSync('node scripts/verify-presentations.mjs', { encoding: 'utf8' });
    ok = /All mappings correct/.test(out);
  } catch (e) {
    out = String(e.stdout ?? e);
  }
  const idLine = (out.match(/PDF identity correct:\s+(\S+)/) ?? [])[1] ?? '?';
  const linkLine = (out.match(/product page links PDF:\s+(\S+)/) ?? [])[1] ?? '?';
  const detail = out.includes('PROBLEMS') ? out.split('PROBLEMS')[1].replace(/\s+/g, ' ').slice(0, 220) : '';
  record('pdf', `presentations mapped correctly (identity ${idLine}, linked ${linkLine})`, ok, detail);
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
