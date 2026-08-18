/**
 * Visual product-image normalization.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every product's hero photo is displayed inside the same fixed-ratio card
 * box (see ProductCard.astro -> Figure.astro, fit="contain"), which never
 * crops but also never fixes what's baked into the source pixels. Two
 * families of source photography exist in this catalogue:
 *
 *   A. Studio renders/cutouts on a near-uniform canvas (black or pale),
 *      where the supplier exported a huge, inconsistent margin around the
 *      product — some fill 90% of the frame, some as little as 32%. No CSS
 *      rule can fix this: `contain` respects the empty canvas as if it were
 *      part of the photo, because it is part of the photo.
 *   B. Real environmental photography (the sauna installed outdoors, full
 *      bleed, no flat canvas to measure) — already well composed, and
 *      cropping into it risks cutting the product or its setting.
 *
 * This script tells the two apart automatically (by how much of the frame
 * `sharp`'s trim() finds to be uniform background) and treats each
 * correctly:
 *
 *   A -> PREPROCESS. Trim tight to the product, then pad back out with a
 *        small, consistent margin sampled from the photo's own background,
 *        so the product occupies a consistent share of the frame across
 *        every model. Written as a new derivative file under
 *        public/images/saunas-normalized/ — the original is never touched.
 *        Each content file's heroImage.src is repointed at the derivative.
 *
 *   B -> LEAVE THE PIXELS ALONE, change the CSS. heroImage.fit is set to
 *        "cover" in frontmatter (new optional schema field, read by
 *        ProductCard/ProductGallery) so the card fills its box like a normal
 *        photograph crop instead of letterboxing around real scenery.
 *
 * This keeps the decision systematic and re-runnable (rerun any time new
 * photography arrives) rather than a per-card manual hack, per the brief.
 *
 *   node scripts/normalize-card-images.mjs           # dry run, prints a report
 *   node scripts/normalize-card-images.mjs --apply    # writes derivatives + frontmatter
 */
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'src', 'content', 'saunas');
const PUBLIC = path.join(ROOT, 'public');
const OUT_DIR = path.join(PUBLIC, 'images', 'saunas-normalized');

const PHOTOGRAPHY_THRESHOLD = 0.85; // trimmed-area / original-area >= this => real photography, leave pixels alone
const MARGIN_RATIO = 0.06;          // padding added back around the tight trim, as a fraction of the larger trimmed dimension

function readHeroBlock(raw) {
  const fm = raw.split('---')[1] ?? '';
  let inHero = false;
  let src = null, alt = null, srcLine = null;
  const lines = fm.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^heroImage:/.test(line)) { inHero = true; continue; }
    if (inHero && /^[A-Za-z]/.test(line)) inHero = false;
    if (!inHero) continue;
    const t = line.trim();
    if (t.startsWith('#')) continue;
    const s = t.match(/^src:\s*(.+)$/);
    if (s) { src = s[1].trim().replace(/^["']|["']$/g, ''); srcLine = i; }
    const a = t.match(/^alt:\s*(.+)$/);
    if (a) alt = a[1].trim().replace(/^["']|["']$/g, '');
  }
  return { src, alt, srcLine };
}

const files = readdirSync(CONTENT).filter((f) => f.endsWith('.md'));

// group content files by the hero src they declare, so a family photo shared
// by several models (EKE, SUSI, ITI) gets ONE derivative and every referencing
// file gets repointed, not just the first one found.
const bySrc = new Map(); // src -> [{file, alt}]
for (const file of files) {
  const raw = readFileSync(path.join(CONTENT, file), 'utf8');
  if (/^draft:\s*true/m.test(raw)) continue;
  const { src, alt } = readHeroBlock(raw);
  if (!src) continue;
  // Idempotency guard: a src already under saunas-normalized/ was produced
  // by a previous run of this script and must never be re-analyzed — its
  // trim ratio no longer reflects "how much excess canvas the SOURCE photo
  // has", only how tight this script's own margin already is, so reprocessing
  // it would compound padding drift or misclassify it as photography.
  if (src.startsWith('/images/saunas-normalized/')) continue;
  if (!bySrc.has(src)) bySrc.set(src, []);
  bySrc.get(src).push({ file, alt });
}

async function sampleBackground(img, hasAlpha) {
  // Average the four corner patches of the ORIGINAL (untrimmed) image — for
  // every image in this catalogue the corners sit outside the product, so
  // this is a reliable read of "the canvas color", not a guess.
  //
  // PNGs in this catalogue mix two real cases: an opaque painted canvas
  // (sample its color) and true transparency (RGB at a transparent pixel is
  // meaningless noise — e.g. one file's "corner color" read as pure red at
  // alpha 1/255, an artifact of unpremultiplied alpha, not a real background).
  // Reading RGB while ignoring alpha silently produces a wrong opaque fill
  // for a transparent cutout, so alpha is checked FIRST and decides the case.
  const { data } = await img.clone().resize(6, 6, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [[0, 0], [5, 0], [0, 5], [5, 5]];
  let r = 0, g = 0, b = 0, a = 0;
  for (const [x, y] of corners) {
    const idx = (y * 6 + x) * 4;
    r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; a += data[idx + 3];
  }
  const avgAlpha = a / 4;
  if (hasAlpha && avgAlpha < 32) {
    // Genuinely transparent canvas — pad with transparency, not a guessed
    // color, so the card's own background shows through the margin.
    return { r: 0, g: 0, b: 0, alpha: 0 };
  }
  return { r: Math.round(r / 4), g: Math.round(g / 4), b: Math.round(b / 4), alpha: 1 };
}

mkdirSync(OUT_DIR, { recursive: true });

const report = { photography: [], normalized: [], skippedNoFile: [] };

for (const [src, refs] of bySrc) {
  const rel = src.replace(/^\//, '');
  const abs = path.join(PUBLIC, rel);
  if (!existsSync(abs)) { report.skippedNoFile.push({ src, refs: refs.map((r) => r.file) }); continue; }

  const original = sharp(abs);
  const meta = await original.metadata();
  const trimmedInfo = await original.clone().trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
  const origArea = (meta.width ?? 1) * (meta.height ?? 1);
  const trimArea = trimmedInfo.info.width * trimmedInfo.info.height;
  const areaRatio = trimArea / origArea;

  if (areaRatio >= PHOTOGRAPHY_THRESHOLD) {
    report.photography.push({ src, areaPct: Math.round(areaRatio * 100), refs: refs.map((r) => r.file) });
    continue;
  }

  const bg = await sampleBackground(original, Boolean(meta.hasAlpha));
  const margin = Math.round(MARGIN_RATIO * Math.max(trimmedInfo.info.width, trimmedInfo.info.height));

  const outName = path.basename(rel);
  const outAbs = path.join(OUT_DIR, outName);
  const outSrc = `/images/saunas-normalized/${outName}`;

  if (APPLY) {
    let pipeline = sharp(trimmedInfo.data).extend({
      top: margin, bottom: margin, left: margin, right: margin,
      background: bg,
    });
    const ext = path.extname(outName).toLowerCase();
    if (ext === '.png') pipeline = pipeline.png({ compressionLevel: 9 });
    else if (ext === '.jpeg' || ext === '.jpg') pipeline = pipeline.jpeg({ quality: 95 });
    await pipeline.toFile(outAbs);
  }

  report.normalized.push({
    src, outSrc,
    before: `${meta.width}x${meta.height} (${Math.round(areaRatio * 100)}% content)`,
    after: `${trimmedInfo.info.width + margin * 2}x${trimmedInfo.info.height + margin * 2}`,
    bg: bg.alpha === 0 ? 'transparent' : `rgb(${bg.r},${bg.g},${bg.b})`,
    refs: refs.map((r) => r.file),
  });
}

// --- apply: rewrite frontmatter -----------------------------------------
if (APPLY) {
  const normalizedBySrc = new Map(report.normalized.map((r) => [r.src, r.outSrc]));
  const photographySrcs = new Set(report.photography.map((r) => r.src));

  for (const file of files) {
    const full = path.join(CONTENT, file);
    const raw = readFileSync(full, 'utf8');
    if (/^draft:\s*true/m.test(raw)) continue;
    const { src } = readHeroBlock(raw);
    if (!src) continue;

    // Files in this repo mix LF and CRLF line endings — every line-break
    // anchor below is \r?\n so the rewrite works either way instead of
    // silently no-op'ing on CRLF files (which is exactly what happened on
    // the first pass: every src-swap succeeded, but all 11 `fit: "cover"`
    // insertions silently failed because their files are CRLF).
    const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let next = raw;
    if (normalizedBySrc.has(src)) {
      const newSrc = normalizedBySrc.get(src);
      // Replace only the heroImage src line's value — alt/note untouched.
      next = next.replace(
        new RegExp(`(heroImage:[\\s\\S]*?\\r?\\n(?:\\s*#.*\\r?\\n)*\\s*src:\\s*)"${escapedSrc}"`),
        `$1"${newSrc}"`
      );
    } else if (photographySrcs.has(src)) {
      // Add fit: cover right after the src line if not already present.
      if (!/heroImage:[\s\S]*?\r?\n\s*fit:/.test(next)) {
        next = next.replace(
          new RegExp(`(heroImage:[\\s\\S]*?\\r?\\n(?:\\s*#.*\\r?\\n)*\\s*src:\\s*"${escapedSrc}"\\r?\\n)`),
          `$1  fit: "cover"\n`
        );
      }
    }
    if (next !== raw) writeFileSync(full, next);
  }
}

// --- report ---------------------------------------------------------------
console.log(APPLY ? 'APPLIED' : 'DRY RUN — pass --apply to write changes');
console.log('');
console.log(`Real photography, left untouched, fit: cover applied (${report.photography.length} images):`);
for (const p of report.photography) console.log(`  · ${p.src}  (${p.areaPct}% already content)  -> ${p.refs.join(', ')}`);
console.log('');
console.log(`Studio renders normalized (${report.normalized.length} images):`);
for (const n of report.normalized) {
  console.log(`  · ${n.src}`);
  console.log(`      ${n.before} -> ${n.after}, bg ${n.bg}`);
  console.log(`      -> ${n.outSrc}`);
  console.log(`      used by: ${n.refs.join(', ')}`);
}
if (report.skippedNoFile.length) {
  console.log('');
  console.log(`SKIPPED — file not found on disk (${report.skippedNoFile.length}):`);
  for (const s of report.skippedNoFile) console.log(`  ✗ ${s.src} -> ${s.refs.join(', ')}`);
}
