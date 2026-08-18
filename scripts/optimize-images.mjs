/**
 * BUXENA — image performance variants.
 *
 * Reads every JPG/PNG under public/images and public/media and writes
 * compressed WebP copies at phone/desktop widths into public/_optimized/,
 * mirroring the source path:
 *
 *   public/images/saunas/ella-h2-hero.png
 *     → public/_optimized/images/saunas/ella-h2-hero-480.webp
 *     → public/_optimized/images/saunas/ella-h2-hero-960.webp
 *     → public/_optimized/images/saunas/ella-h2-hero-1600.webp  (if source is that wide)
 *
 * ORIGINALS ARE NEVER TOUCHED — never overwritten, renamed, resized or
 * deleted. Deleting public/_optimized/ reverts the whole exercise; the
 * site automatically falls back to the originals (see
 * src/lib/optimized-image.ts). Aspect ratios are always preserved
 * (resize by width only). Idempotent: existing up-to-date variants are
 * skipped, so re-running after new images arrive is cheap.
 *
 * og-brand-card.jpg is skipped: social scrapers read that file directly
 * from its meta tag; it must stay a plain JPG and needs no variants.
 */
import sharp from 'sharp';
import { readdirSync, statSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['public/images', 'public/media'];
const OUT_ROOT = 'public/_optimized';
const WIDTHS = [480, 960, 1600];
const QUALITY = 78;
const SKIP = new Set(['og-brand-card.jpg']);

const files = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jpe?g|png)$/i.test(name) && !SKIP.has(name)) files.push(p);
  }
};
ROOTS.forEach(walk);

let made = 0, skipped = 0, pruned = 0, srcBytes = 0, outBytes = 0;
for (const file of files) {
  const meta = await sharp(file).metadata();
  const rel = path.relative('public', file);
  const relNoExt = rel.slice(0, -path.extname(rel).length);
  srcBytes += statSync(file).size;

  // Widths no larger than the source (never enlarge). A source smaller than
  // the smallest tier still gets a "-480" variant (at its native size —
  // withoutEnlargement never upscales) so the fixed-name lookup in
  // src/lib/optimized-image.ts always finds one.
  //
  // ALSO emit the source's native width when it falls between tiers. Without
  // this, an 800px product photo offered only a 480w candidate, and desktop
  // browsers upscaled it — visibly soft on exactly the images that sell.
  const srcW = meta.width ?? 0;
  let widths = WIDTHS.filter((w) => w <= srcW);
  if (widths.length === 0) widths = [WIDTHS[0]];
  else if (srcW > widths[widths.length - 1] && srcW < WIDTHS[WIDTHS.length - 1]) widths.push(srcW);

  // If a source image is replaced with a different native width, an old
  // native-width variant can remain beside the new 480/960/1600 files. The
  // browser may then select that obsolete image from srcset (for example an
  // old 879px AAPO render), even though every current tier was regenerated.
  // Remove only variants belonging to this exact source basename whose width
  // is no longer part of the current output set.
  const outDir = path.join(OUT_ROOT, path.dirname(relNoExt));
  const outBase = path.basename(relNoExt);
  if (existsSync(outDir)) {
    for (const name of readdirSync(outDir)) {
      const match = name.match(new RegExp(`^${outBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{3,4})\\.webp$`));
      if (!match || widths.includes(Number(match[1]))) continue;
      unlinkSync(path.join(outDir, name));
      pruned++;
    }
  }

  for (const w of widths) {
    const out = path.join(OUT_ROOT, `${relNoExt}-${w}.webp`);
    if (existsSync(out) && statSync(out).mtimeMs >= statSync(file).mtimeMs) {
      skipped++;
      outBytes += statSync(out).size;
      continue;
    }
    mkdirSync(path.dirname(out), { recursive: true });
    await sharp(file).resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(out);
    outBytes += statSync(out).size;
    made++;
  }
}

console.log(`sources:  ${files.length} images, ${(srcBytes / 1048576).toFixed(1)} MB`);
console.log(`variants: ${made} written, ${skipped} already current, ${pruned} obsolete removed, ${(outBytes / 1048576).toFixed(1)} MB total`);
