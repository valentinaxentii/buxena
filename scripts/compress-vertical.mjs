/**
 * One-shot codemod: reduce vertical spacing by 15% on non-home public pages.
 *
 * WHY A CODEMOD AND NOT HAND EDITS
 * --------------------------------
 * The shared design system carries most of the site's rhythm and was retuned by
 * hand (tokens in global.css, scoped to `body:not(.is-home)`). What remains is a
 * long tail of page-scoped clamps — dozens of them across ~30 page files. Hand
 * editing that many values is where inconsistency creeps in.
 *
 * SCOPE, DELIBERATELY NARROW
 *   · src/pages/**.astro EXCEPT index.astro (the homepage is out of scope by
 *     founder instruction) and EXCEPT admin/ (staff-only, not a public page)
 *   · Astro page styles are SCOPED to their own page, so editing them cannot
 *     leak into the homepage. Shared components are NOT touched here — they go
 *     through the tokens instead, precisely so Home keeps the originals.
 *
 * PROPERTIES, DELIBERATELY UNAMBIGUOUS
 *   margin-top/bottom/block, padding-top/bottom/block, row-gap, scroll-margin-top.
 *
 *   `gap: X` is NOT touched. In a grid the shorthand sets BOTH axes, so
 *   shrinking it would narrow columns as well as rows — a horizontal change
 *   nobody asked for. `gap: X Y` is likewise skipped; only explicit `row-gap`
 *   is safe to treat as vertical.
 *
 * Values below 0.5rem are left alone: they are hairline offsets and optical
 * nudges, where 15% is invisible and rounding does more harm than good.
 *
 *   node scripts/compress-vertical.mjs --dry     # show what would change
 *   node scripts/compress-vertical.mjs --apply
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const FACTOR = 0.85;
const MIN_REM = 0.5;

const ROOT = process.cwd();
const PAGES = path.join(ROOT, 'src', 'pages');

const VERTICAL = /\b(margin-top|margin-bottom|margin-block|padding-top|padding-bottom|padding-block|row-gap|scroll-margin-top)\s*:\s*([^;{}]+);/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'admin') continue; // staff-only, not a public page
      out.push(...walk(full));
    } else if (entry.endsWith('.astro')) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(PAGES).filter((f) => path.relative(PAGES, f) !== 'index.astro');

let changedFiles = 0;
let changedValues = 0;
const report = [];

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let fileTouched = false;

  const updated = original.replace(VERTICAL, (whole, prop, value) => {
    // Skip anything that is not a plain length: var(), calc(), 0, auto,
    // percentages, and keywords all stay exactly as written.
    if (/var\(|calc\(|%|auto|inherit|initial|unset/.test(value)) return whole;

    let touched = false;
    // The vw term must scale too. Reducing only the rem endpoints of a
    // clamp(min, base + Nvw, max) leaves the slope alone, so the middle term
    // outruns the new max and the reduction lands at 15% only at the extremes
    // — intermediate viewport widths would silently get less than asked for.
    const newValue = value.replace(/(\d*\.?\d+)(rem|vw|px)/g, (m, num, unit) => {
      const n = parseFloat(num);
      if (unit === 'rem' && n < MIN_REM) return m;   // hairline offsets: leave alone
      if (unit === 'px' && n < 8) return m;
      const scaled = Math.round(n * FACTOR * 100) / 100;
      if (scaled === n) return m;
      touched = true;
      changedValues++;
      return `${scaled}${unit}`;
    });

    if (!touched) return whole;
    fileTouched = true;
    report.push(
      `  ${path.relative(ROOT, file).replace(/\\/g, '/')}\n      ${prop}: ${value.trim()}\n   →  ${prop}: ${newValue.trim()}`
    );
    return `${prop}: ${newValue};`;
  });

  if (fileTouched) {
    changedFiles++;
    if (APPLY) writeFileSync(file, updated);
  }
}

console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'} — vertical compression ×${FACTOR}`);
console.log(`  public page files scanned: ${files.length}`);
console.log(`  files changed:             ${changedFiles}`);
console.log(`  values changed:            ${changedValues}\n`);
for (const r of report) console.log(r);
if (!APPLY) console.log('\nnothing written — re-run with --apply');
