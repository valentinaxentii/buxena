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
const VARIANT_RE = /-(\d{3,4})\.webp$/;
const cache = new Map<string, string | null>();

export function webpSrcset(src?: string): string | null {
  if (!src || !/^\/(images|media)\//.test(src)) return null;
  const ext = path.extname(src).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return null;

  const hit = cache.get(src);
  if (hit !== undefined) return hit;

  const relNoExt = src.slice(1, src.length - ext.length);
  // Discover every generated variant for this image, including the native
  // width emitted when a source falls between tiers.
  const dir = path.join(process.cwd(), 'public', '_optimized', path.dirname(relNoExt));
  const base = path.basename(relNoExt);
  let entries: { w: number; url: string }[] = [];
  try {
    entries = fs.readdirSync(dir)
      .filter((f) => f.startsWith(base + '-') && f.endsWith('.webp'))
      .map((f) => ({ w: Number((f.match(VARIANT_RE) ?? [])[1] ?? 0), f }))
      .filter((e) => e.w > 0)
      .sort((a, b) => a.w - b.w)
      .map((e) => ({
        w: e.w,
        url: `/_optimized/${path.dirname(relNoExt).split(path.sep).join('/')}/${e.f}`,
      }));
  } catch { entries = []; }

  const result = entries.length ? entries.map((e) => `${e.url} ${e.w}w`).join(', ') : null;
  cache.set(src, result);
  return result;
}
