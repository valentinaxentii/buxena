/**
 * Report every sauna hero image that is not backed by genuine transparency,
 * plus any card still forced to cover. This complements image-integrity.mjs:
 * integrity proves paths resolve; this script proves card assets have alpha.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const contentDir = path.resolve('src/content/saunas');
const publicDir = path.resolve('public');
const files = (await readdir(contentDir)).filter((file) => file.endsWith('.md'));
const findings = [];

for (const file of files) {
  const markdown = await readFile(path.join(contentDir, file), 'utf8');
  const title = markdown.match(/^title:\s*"([^"]+)"/m)?.[1] ?? file;
  const heroBlock = markdown.match(/^heroImage:\s*\r?\n((?:^[ \t].*(?:\r?\n|$))*)/m)?.[1] ?? '';
  const src = heroBlock.match(/^\s*src:\s*"([^"]+)"/m)?.[1];
  const fit = heroBlock.match(/^\s*fit:\s*"([^"]+)"/m)?.[1] ?? 'contain';
  if (!src) continue;

  const diskPath = path.join(publicDir, src.replace(/^\//, ''));
  const metadata = await sharp(diskPath).metadata();
  let transparentPercent = 0;

  if (metadata.hasAlpha) {
    const { data } = await sharp(diskPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 255) transparent++;
    }
    transparentPercent = (transparent / (data.length / 4)) * 100;
  }

  if (transparentPercent < 0.1 || fit === 'cover') {
    findings.push({
      title,
      file,
      src,
      fit,
      transparent: `${transparentPercent.toFixed(1)}%`,
    });
  }
}

console.table(findings);
console.log(`${findings.length} card image${findings.length === 1 ? '' : 's'} still require attention.`);
