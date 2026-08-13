/**
 * No card, anywhere, may ever render a broken image.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Sauna Advisor shortlist rendered:
 *
 *     <img src="${model.heroImage?.src ?? ''}" alt="...">
 *
 * `?? ''` reads as a guard and is the exact opposite of one. An empty `src`
 * resolves against the current document, the browser fetches the HTML page,
 * fails to decode it as an image, and paints the ALT TEXT into the card.
 * Sixteen of thirty-five models have no `src` — every EDA, stripped by the
 * image-rights audit — so this fired constantly. The founder hit it on the
 * first result they looked at.
 *
 * Astro-rendered grids were never affected: they go through ProductCard →
 * Figure.astro, which renders a designed placeholder when there is no src. Only
 * the two surfaces that build cards in the browser bypassed that. This script
 * makes the rule checkable rather than remembered.
 *
 * THREE CHECKS
 *   1. every declared heroImage.src exists on disk, matching case exactly
 *      (Windows and macOS are case-insensitive; the Linux build host is not,
 *      so a case slip passes locally and 404s in production)
 *   2. no source file still interpolates a possibly-empty src into an <img>
 *   3. models without photography are reported, not failed — that is a known,
 *      deliberate state pending supplier licensing
 *
 *   node scripts/image-integrity.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'src', 'content', 'saunas');
const PUBLIC = path.join(ROOT, 'public');

const failures = [];
const noPhoto = [];
let declared = 0;

/**
 * Read heroImage from frontmatter, SKIPPING COMMENT LINES.
 *
 * This matters more than it looks. The image-rights audit left
 * `# src: removed 2026-08-13 …` inside the heroImage block of every affected
 * model. A naive `grep src:` matches that comment and reports the model as
 * having a photograph — which is precisely how an earlier version of this
 * check declared "0 models missing images" while sixteen were missing.
 */
function readHero(file) {
  const raw = readFileSync(path.join(CONTENT, file), 'utf8');
  const fm = raw.split('---')[1] ?? '';
  let inHero = false;
  let src = null;
  let alt = null;
  for (const line of fm.split(/\r?\n/)) {
    if (/^heroImage:/.test(line)) { inHero = true; continue; }
    if (inHero && /^[A-Za-z]/.test(line)) inHero = false;
    if (!inHero) continue;
    const t = line.trim();
    if (t.startsWith('#')) continue;
    const s = t.match(/^src:\s*(.+)$/);
    if (s) src = s[1].trim().replace(/^["']|["']$/g, '');
    const a = t.match(/^alt:\s*(.+)$/);
    if (a) alt = a[1].trim().replace(/^["']|["']$/g, '');
  }
  return { src, alt };
}

/** Case-exact existence check, walking each path segment. */
function existsCaseExact(relative) {
  const clean = relative.split('?')[0].replace(/^\//, '');
  let dir = PUBLIC;
  const parts = clean.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return { ok: false, reason: `directory not found: ${dir.replace(ROOT, '')}` };
    }
    if (!entries.includes(parts[i])) {
      const ci = entries.find((e) => e.toLowerCase() === parts[i].toLowerCase());
      return {
        ok: false,
        reason: ci
          ? `case mismatch — file on disk is "${ci}", frontmatter says "${parts[i]}"`
          : `missing: ${parts[i]}`,
      };
    }
    dir = path.join(dir, parts[i]);
  }
  return { ok: true };
}

// --- 1 + 3: every model's declared image ------------------------------------
const files = readdirSync(CONTENT).filter((f) => f.endsWith('.md'));
for (const file of files) {
  const raw = readFileSync(path.join(CONTENT, file), 'utf8');
  if (/^draft:\s*true/m.test(raw)) continue;

  const { src, alt } = readHero(file);
  const slug = file.replace(/\.md$/, '');

  if (!alt || !alt.trim()) {
    failures.push(`${slug} — heroImage has no alt text (needed by the placeholder too)`);
  }

  if (!src) {
    noPhoto.push(slug);
    continue;
  }
  declared++;

  if (!/^\//.test(src)) {
    failures.push(`${slug} — heroImage.src "${src}" is not an absolute public path`);
    continue;
  }
  const result = existsCaseExact(src);
  if (!result.ok) failures.push(`${slug} — heroImage.src "${src}" ${result.reason}`);
}

// --- 2: no source may interpolate a possibly-empty src -----------------------
// The specific shape that caused the bug, plus the general shape of an <img>
// whose src comes from an optional-chained expression with an empty fallback.
const EMPTY_SRC_PATTERNS = [
  { re: /<img[^>]*\bsrc\s*=\s*["']\$\{[^}]*\?\?\s*['"]['"]\s*\}/, why: 'src falls back to an empty string' },
  { re: /<img[^>]*\bsrc\s*=\s*["']["']/, why: 'literal empty src' },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(astro|ts|tsx|js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

for (const file of walk(path.join(ROOT, 'src'))) {
  const text = readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const { re, why } of EMPTY_SRC_PATTERNS) {
    text.split(/\r?\n/).forEach((line, i) => {
      // Comments describing the bug are not the bug. card-media.ts documents
      // the exact broken pattern it exists to prevent, and this check flagged
      // that prose on its first run.
      const t = line.trim();
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
      // The admin lightbox legitimately ships an empty <img> that JS fills on
      // open; it is staff-only and never shows a product card.
      if (/data-lb-img|data-pdlb-img/.test(line)) return;
      if (re.test(line)) failures.push(`${rel}:${i + 1} — ${why}`);
    });
  }
}

// --- report ------------------------------------------------------------------
console.log('Image integrity');
console.log(`  models checked:        ${files.length}`);
console.log(`  with photography:      ${declared}`);
console.log(`  awaiting licensing:    ${noPhoto.length}  (placeholder treatment — not a failure)`);
if (noPhoto.length) {
  for (const s of noPhoto) console.log(`      · ${s}`);
}
console.log('');

if (failures.length) {
  console.log(`IMAGE INTEGRITY FAILURES: ${failures.length}`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('all declared images resolve, and no source can emit an empty src');
