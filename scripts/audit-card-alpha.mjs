/**
 * Report every sauna hero image that has neither genuine transparency nor a
 * verified uniform BUXENA linen studio background, plus any card still forced
 * to cover. Both treatments are visually clear and intentional; scene photos,
 * checkerboards and accidental white rectangles are not.
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
  let hasUniformLinenBackground = false;

  if (metadata.hasAlpha) {
    const { data } = await sharp(diskPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 255) transparent++;
    }
    transparentPercent = (transparent / (data.length / 4)) * 100;
  }

  if (transparentPercent < 0.1) {
    const { data, info } = await sharp(diskPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const points = [
      [0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1],
      [10, 10], [info.width - 11, 10], [10, info.height - 11], [info.width - 11, info.height - 11],
    ];
    const samples = points.map(([x, y]) => {
      const index = (y * info.width + x) * 3;
      return [data[index], data[index + 1], data[index + 2]];
    });
    const average = [0, 1, 2].map((channel) =>
      samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length
    );
    const maxDelta = Math.max(...samples.flatMap((sample) =>
      sample.map((value, channel) => Math.abs(value - average[channel]))
    ));
    const isWarmLightLinen = average[0] >= 235 && average[1] >= 228 && average[2] >= 218;
    hasUniformLinenBackground = isWarmLightLinen && maxDelta <= 8;
  }

  if ((transparentPercent < 0.1 && !hasUniformLinenBackground) || fit === 'cover') {
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
