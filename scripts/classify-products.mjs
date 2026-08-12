/**
 * Classifies every sellable model for configurator readiness, and prints the
 * A / B / C counts.
 *
 *   A REAL CONFIGURATOR — verified choices exist; the configurator is shown.
 *   B QUOTE-ONLY        — nothing configurable about this model; correct as-is.
 *   C BLOCKED DATA      — a sibling in the same series HAS verified options, so
 *                         this one plausibly does too and nobody has recorded
 *                         them. Not a product fact: a task with a supplier's
 *                         name on it.
 *
 * B and C look identical on the website — both hide the configurator — but they
 * are completely different commercially. B needs nothing. C is a supplier
 * follow-up that unlocks a configurator the moment it is answered.
 *
 * Read-only. Reads the same frontmatter the site reads.
 *
 *   node scripts/classify-products.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../src/content/saunas/', import.meta.url);

function frontmatter(raw) {
  // Normalize CRLF first. These files are checked out with Windows line
  // endings, so an unnormalized `^options:` silently matches only the
  // LF-terminated files — which reports a data gap that does not exist.
  const text = raw.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}
function has(fm, key) {
  return new RegExp(`^${key}:`, 'm').test(fm);
}
function materialsCount(fm) {
  const m = fm.match(/^materials:\s*\[(.*)\]/m);
  if (!m) return 0;
  return m[1].split(',').filter((s) => s.trim()).length;
}
function seriesOf(fm) {
  const m = fm.match(/^series:\s*"?([^"\n]+)"?/m);
  return m ? m[1].trim() : '';
}
function titleOf(fm) {
  const m = fm.match(/^title:\s*"?([^"\n]+)"?/m);
  return m ? m[1].trim() : '(untitled)';
}

const models = [];
for (const file of readdirSync(DIR)) {
  if (!file.endsWith('.md')) continue;
  const raw = readFileSync(new URL(file, DIR), 'utf8');
  const fm = frontmatter(raw);
  if (/^draft:\s*true/m.test(fm)) continue; // held models are not sellable

  models.push({
    slug: file.replace(/\.md$/, ''),
    title: titleOf(fm),
    series: seriesOf(fm),
    // Mirrors buildConfigGroups in src/lib/product-config.ts.
    hasOptions: has(fm, 'options'),
    hasHeater: has(fm, 'heaterOptions'),
    multiMaterial: materialsCount(fm) > 1,
  });
}

const configurable = (m) => m.hasOptions || m.hasHeater || m.multiMaterial;
const seriesHasConfigurable = new Map();
for (const m of models) {
  if (configurable(m)) seriesHasConfigurable.set(m.series, true);
}

// A series where NOT ONE model records options, in a catalogue where other
// series record them consistently, is a gap in our data rather than a fact
// about the product. Treating it as "quote-only" would quietly write off the
// follow-up; it belongs in C, against the supplier who owes us the answer.
const anySeriesConfigurable = [...seriesHasConfigurable.values()].some(Boolean);
const seriesIsWhollyBare = new Map();
for (const m of models) {
  if (!m.series) continue;
  if (!seriesIsWhollyBare.has(m.series)) seriesIsWhollyBare.set(m.series, true);
  if (configurable(m)) seriesIsWhollyBare.set(m.series, false);
}

const A = [], B = [], C = [];
for (const m of models) {
  if (configurable(m)) A.push(m);
  else if (m.series && seriesHasConfigurable.get(m.series)) C.push(m);
  else if (m.series && anySeriesConfigurable && seriesIsWhollyBare.get(m.series)) C.push(m);
  else B.push(m);
}

const pct = (n) => `${Math.round((n / models.length) * 100)}%`;

console.log(`\nBUXENA — configurator readiness (${models.length} sellable models)`);
console.log('─'.repeat(72));
console.log(`A  REAL CONFIGURATOR   ${String(A.length).padStart(3)}  ${pct(A.length).padStart(4)}   configurator shown`);
console.log(`B  QUOTE-ONLY          ${String(B.length).padStart(3)}  ${pct(B.length).padStart(4)}   nothing to configure — correct as-is`);
console.log(`C  BLOCKED DATA        ${String(C.length).padStart(3)}  ${pct(C.length).padStart(4)}   supplier follow-up unlocks a configurator`);
console.log('─'.repeat(72));

if (C.length) {
  console.log('\nC — BLOCKED, grouped by series (chase these with the supplier):');
  const bySeries = new Map();
  for (const m of C) {
    if (!bySeries.has(m.series)) bySeries.set(m.series, []);
    bySeries.get(m.series).push(m);
  }
  for (const [series, list] of [...bySeries].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${series || '(no series)'} — ${list.length} model(s)`);
    for (const m of list) console.log(`     ${m.slug}`);
  }
}

if (B.length) {
  console.log('\nB — QUOTE-ONLY (no sibling has options either):');
  for (const m of B) console.log(`  ${m.slug}`);
}

console.log('\nWhat unlocks a configurator: `options`, `heaterOptions`, or two or');
console.log('more `materials` in the model\'s frontmatter. Adding any of them turns');
console.log('its configurator on automatically — no code change.\n');
