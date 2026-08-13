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
  const heroMatch = raw.match(/heroImage:\s*\n?\s*src:\s*["']?([^"'\n]+)/) || raw.match(/heroImage:[\s\S]{0,200}?src:\s*["']?([^"'\n]+)/);
  const heroSrc = heroMatch ? heroMatch[1].trim() : '';
  const heroAlt = (raw.match(/heroImage:[\s\S]{0,300}?alt:\s*["']?([^"'\n]+)/) || [])[1] ?? '';

  const problems = [];
  if (!heroSrc) problems.push('NO hero image');
  else if (!existsSync(path.join(PUBLIC, heroSrc.replace(/^\//, '')))) problems.push(`hero MISSING on disk: ${heroSrc}`);
  if (heroSrc && !heroAlt) problems.push('hero has no alt text');

  if (unquote(fm.placeholder) !== 'false') problems.push('placeholder: true (dev notice would show)');
  if (!unquote(fm.capacity)) problems.push('no capacity');
  if (!/dimensions:/.test(raw)) problems.push('no dimensions');
  if (!/materials:/.test(raw)) problems.push('no materials');
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

  rows.push({ slug, category, location, productType, problems });
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

// Non-zero so the pre-launch board and any CI can gate on it.
process.exit(rows.length - clean.length === 0 ? 0 : 1);
