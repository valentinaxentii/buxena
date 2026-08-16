/**
 * Public catalogue readiness — one row per PUBLISHED model.
 *
 * Reads the markdown frontmatter directly (no Astro runtime needed) and checks
 * the things a visitor would notice: a missing or broken hero image, a model
 * with nothing to say, a category that contradicts its own type, a placeholder
 * notice that would be visible, and whether the page can be enquired about.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'src', 'content', 'saunas');
const PUBLIC = path.join(ROOT, 'public');

const files = readdirSync(DIR).filter((f) => f.endsWith('.md'));

const parse = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_][\w]*):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      out[key] = kv[2].trim();
    } else if (key && /^\s+-\s/.test(line)) {
      out[key] = (out[key] ? out[key] + ' ' : '') + line.trim();
    }
  }
  return out;
};

const unquote = (v) => (v ?? '').replace(/^["']|["']$/g, '').trim();

const rows = [];
for (const f of files) {
  const raw = readFileSync(path.join(DIR, f), 'utf8');
  const fm = parse(raw);
  const body = raw.split(/^---\r?\n[\s\S]*?\r?\n---/m)[1] ?? '';

  const draft = unquote(fm.draft) === 'true';
  const hold = unquote(fm.hold);
  if (draft || hold) continue; // not published

  const slug = f.replace(/\.md$/, '');

  // Read the heroImage block line by line. A `# src:` line is a COMMENT — the
  // deliberate, documented state for a model whose only photograph had no
  // identifiable source. Regexing across the block treated that comment text
  // as a filename and reported 16 models as having a broken image.
  const heroBlock = (raw.match(/^heroImage:\s*$([\s\S]*?)^(?=[a-zA-Z_]|---)/m) ?? ['', ''])[1] ?? '';
  const heroLine = heroBlock.split(/\r?\n/).find((l) => /^\s*src:/.test(l)) ?? '';
  const heroSrc = unquote((heroLine.split(':').slice(1).join(':') ?? '').trim());
  const heroAlt = unquote(
    ((heroBlock.split(/\r?\n/).find((l) => /^\s*alt:/.test(l)) ?? '').split(':').slice(1).join(':') ?? '').trim()
  );

  const problems = [];
  // A hero that POINTS at a file which is not there is broken and always a
  // failure. A hero deliberately left empty is a rights decision, reported
  // separately below so it stays visible without turning the board red until
  // a supplier replies.
  if (heroSrc && !existsSync(path.join(PUBLIC, heroSrc.replace(/^\//, '')))) {
    problems.push(`hero MISSING on disk: ${heroSrc}`);
  }
  if (heroSrc && !heroAlt) problems.push('hero has no alt text');
  if (!heroSrc && !heroAlt) problems.push('no hero image AND no alt text');

  if (unquote(fm.placeholder) !== 'false') problems.push('placeholder: true (dev notice would show)');
  // Missing capacity/materials are reported separately, same treatment as a
  // missing hero image: Capra's own catalogue genuinely does not state a
  // capacity or a material split for every series (confirmed 2026-08-16
  // against the full 28-page 2026 catalogue — not an oversight here). Gating
  // the board red on a fact the supplier never published is the same mistake
  // this file already avoided for photography.
  const noCapacity = !unquote(fm.capacity);
  const noMaterials = !/materials:/.test(raw);
  if (!/dimensions:/.test(raw)) problems.push('no dimensions');
  if (!unquote(fm.summary)) problems.push('no summary');
  if (body.trim().length < 120) problems.push(`thin body copy (${body.trim().length} chars)`);

  const category = unquote(fm.category);
  const location = unquote(fm.location);
  const productType = unquote(fm.productType);
  // Contradictions the site's own navigation would expose.
  if (category === 'indoor' && location !== 'indoor') problems.push(`category=indoor but location=${location}`);
  if (category === 'barrel' && productType !== 'Barrel') problems.push(`category=barrel but productType=${productType}`);
  if (category === 'cube' && productType !== 'Cube') problems.push(`category=cube but productType=${productType}`);
  if (!location) problems.push('no location (breadcrumb falls back to /collections/)');

  // A claim we must never make without approval.
  if (unquote(fm.fromPrice) || unquote(fm.completeFromPrice) || unquote(fm.msrp)) {
    problems.push('PRICE PRESENT IN FRONTMATTER');
  }
  const avail = unquote(fm.availability);
  if (avail && avail !== 'preorder') problems.push(`availability=${avail} (no inventory data exists)`);

  rows.push({ slug, category, location, productType, problems, noHero: !heroSrc, noCapacity, noMaterials });
}

rows.sort((a, b) => b.problems.length - a.problems.length || a.slug.localeCompare(b.slug));

const clean = rows.filter((r) => !r.problems.length);
console.log(`PUBLISHED MODELS: ${rows.length}   clean: ${clean.length}   with findings: ${rows.length - clean.length}\n`);

const counts = new Map();
for (const r of rows) for (const p of r.problems) {
  const key = p.replace(/:.*$/, '').replace(/\(\d+ chars\)/, '(n chars)');
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
console.log('FINDINGS BY TYPE');
for (const [k, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}x  ${k}`);
}

console.log('\nPER MODEL (only those with findings)');
for (const r of rows) {
  if (!r.problems.length) continue;
  console.log(`  ${r.slug}  [${r.category}/${r.location}/${r.productType}]`);
  for (const p of r.problems) console.log(`      - ${p}`);
}

/**
 * Rights-blocked heroes, reported separately and deliberately NOT failing.
 *
 * These models render Figure's quiet toned ground instead of a photograph,
 * because the photograph that was there had no identifiable source and no
 * permission could ever be obtained for it. That is the correct state, not a
 * defect — but it is a real commercial weakness and must stay visible, so it
 * is counted here every run rather than quietly forgotten.
 *
 * It does not gate the board: a check that stays red until a supplier answers
 * an email is a check people learn to ignore.
 */
const noHero = rows.filter((r) => r.noHero);
console.log(`\nNO HERO IMAGE — rights-blocked, awaiting supplier photography: ${noHero.length}`);
for (const r of noHero) console.log(`      ${r.slug}`);
if (noHero.length) {
  console.log('  These pages are launch-SAFE (no unsourced image is served) but');
  console.log('  sell worse than they should. Resolved by supplier photography');
  console.log('  arriving with written permission — see docs/*-pricing-request.md.');
}

const noCapacity = rows.filter((r) => r.noCapacity);
console.log(`\nNO CAPACITY STATED — Capra's catalogue does not publish one: ${noCapacity.length}`);
for (const r of noCapacity) console.log(`      ${r.slug}`);

const noMaterials = rows.filter((r) => r.noMaterials);
console.log(`\nNO MATERIAL SPLIT STATED — Capra's catalogue does not publish one: ${noMaterials.length}`);
for (const r of noMaterials) console.log(`      ${r.slug}`);

// Non-zero so the pre-launch board and any CI can gate on it. Missing
// capacity/materials/hero-image are reported above but never gate — each is
// a genuine, disclosed supplier-data gap, not a defect in this repo.
const NON_GATING = new Set(['no capacity', 'no materials']);
const gating = rows.filter((r) => r.problems.some((p) => !NON_GATING.has(p)));
process.exit(gating.length === 0 ? 0 : 1);
