/**
 * Every public route, actually requested from a running server.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-08-13 /saunas/ — the main catalogue — threw
 * `ReferenceError: byPhotographedThenOrder is not defined` at runtime and the
 * page was blank. The founder found it in a browser. Nothing in the pipeline
 * stopped it reaching them:
 *
 *   - `astro check` DID report the error. It was chained behind `&&` with a
 *     grep that printed before the error count, so a non-zero exit was read as
 *     success. A check nobody reads carefully is not a gate.
 *   - `npm run build` never ran, because the same chain aborted first.
 *   - The pre-launch board's "key journey pages respond" check hits a handful
 *     of routes, and its list did not include every generated product page.
 *
 * The lesson is not "read output more carefully". It is that nothing in the
 * suite ever ASKED A SERVER FOR EVERY PAGE. A missing import is invisible to a
 * static check of the built HTML if the build is what failed.
 *
 * So this script requests every route — all 32 product pages individually, not
 * one representative — and fails on a non-2xx, on an error signature in the
 * body, or on a page that renders suspiciously empty.
 *
 *   node scripts/runtime-routes.mjs                  # against localhost:4321
 *   node scripts/runtime-routes.mjs http://host:port # against a preview
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');

// Product routes come from the content directory, so a newly added model is
// covered the day it is added rather than when someone remembers to list it.
const contentDir = path.join(process.cwd(), 'src', 'content', 'saunas');
const productRoutes = readdirSync(contentDir)
  .filter((f) => f.endsWith('.md'))
  .filter((f) => {
    const raw = readFileSync(path.join(contentDir, f), 'utf8');
    // Skip draft/held models — they intentionally have no page.
    return !/^draft:\s*true/m.test(raw) && !/^hold:\s*\S/m.test(raw);
  })
  .map((f) => `/saunas/${f.replace(/\.md$/, '')}/`);

const STATIC_ROUTES = [
  '/',
  '/saunas/',
  '/saunas/barrel-saunas/',
  '/saunas/cube-saunas/',
  '/saunas/indoor-saunas/',
  '/saunas/outdoor-saunas/',
  '/collections/barrel/',
  '/collections/cube/',
  '/collections/indoor/',
  '/compare/',
  '/plan-your-sauna/',
  '/see-it-in-my-space/',
  '/my-project/',
  '/start-your-project/',
  '/quote/',
  '/consultation/',
  '/for-trade/',
  '/how-buying-works/',
  '/heater-guide/',
  '/thank-you/',
  '/contact/',
  '/faq/',
  '/warranty/',
  '/shipping/',
  '/returns/',
  '/our-story/',
  '/wellness/',
  '/privacy/',
  '/terms/',
  '/accessibility/',
];

/** Signatures that mean the server rendered an error into the page body. */
const ERROR_SIGNATURES = [
  'ReferenceError',
  'TypeError',
  'is not defined',
  'is not a function',
  'Cannot read properties',
  'Internal Server Error',
  'Unhandled Rejection',
  'astro-error',
  'Cannot find module',
];

/** Below this, a page rendered but has essentially nothing in it. */
const MIN_BYTES = 2000;

const failures = [];
let checked = 0;

async function probe(route, { expect = 200 } = {}) {
  checked++;
  let res;
  let body = '';
  try {
    res = await fetch(BASE + route, { redirect: 'manual' });
    body = await res.text();
  } catch (e) {
    failures.push(`${route} — request failed: ${e.message}`);
    return;
  }

  if (res.status !== expect) {
    failures.push(`${route} — expected ${expect}, got ${res.status}`);
    return;
  }
  const hit = ERROR_SIGNATURES.find((s) => body.includes(s));
  if (hit) {
    failures.push(`${route} — error signature in body: "${hit}"`);
    return;
  }
  if (expect === 200 && body.length < MIN_BYTES) {
    failures.push(`${route} — rendered only ${body.length} bytes (looks empty)`);
  }
}

console.log(`Runtime route sweep against ${BASE}`);
console.log(`  ${STATIC_ROUTES.length} static routes + ${productRoutes.length} product routes\n`);

for (const r of [...STATIC_ROUTES, ...productRoutes]) await probe(r);

// A bad URL must 404, not 500 — and must not leak an error page.
await probe('/definitely-not-a-real-page/', { expect: 404 });

// Admin must redirect anonymous callers, never render.
for (const r of ['/admin', '/admin/enquiries', '/admin/settings']) {
  checked++;
  const res = await fetch(BASE + r, { redirect: 'manual' });
  if (res.status !== 302) failures.push(`${r} — expected 302 redirect, got ${res.status}`);
}

console.log(`routes checked: ${checked}`);
if (failures.length) {
  console.log(`\nRUNTIME FAILURES: ${failures.length}`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('all routes rendered successfully — no runtime errors');
