/**
 * Build-time lookup for the WebP variants that scripts/optimize-images.mjs
 * generates under public/_optimized/.
 *
 * Returns a srcset string ("/_optimized/…-480.webp 480w, …") when variants
 * exist on disk for the given public path, or null when they don't — in
 * which case callers render the original <img> exactly as before. That
 * makes the whole optimization safely reversible: delete public/_optimized/
 * and every page falls back to the untouched originals.
 *
 * Runs only at build/render time on the server (fs access) — never in the
 * browser.
 */
import fs from 'node:fs';
import path from 'node:path';

const WIDTHS = [480, 960, 1600];
const cache = new Map<string, string | null>();

export function webpSrcset(src?: string): string | null {
  if (!src || !/^\/(images|media)\//.test(src)) return null;
  const ext = path.extname(src).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return null;

  const hit = cache.get(src);
  if (hit !== undefined) return hit;

  const relNoExt = src.slice(1, src.length - ext.length);
  const entries = WIDTHS.map((w) => ({
    w,
    file: path.join(process.cwd(), 'public', '_optimized', `${relNoExt}-${w}.webp`),
    url: `/_optimized/${relNoExt}-${w}.webp`,
  })).filter((e) => fs.existsSync(e.file));

  const result = entries.length ? entries.map((e) => `${e.url} ${e.w}w`).join(', ') : null;
  cache.set(src, result);
  return result;
}
