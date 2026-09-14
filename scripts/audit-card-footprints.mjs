/**
 * Read-only audit of the visible product footprint in every sauna hero image.
 * This catches supplier exports with large transparent or flat-color margins,
 * which CSS object-fit cannot distinguish from real product pixels.
 */
import sharp from 'sharp';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'src', 'content', 'saunas');
const PUBLIC_DIR = path.join(ROOT, 'public');

function readField(raw, field) {
  const match = raw.match(new RegExp(`^${field}:\\s*["']?([^"'\\r\\n]+)`, 'm'));
  return match?.[1]?.trim() ?? '';
}

function readHeroSrc(raw) {
  return raw.match(/^heroImage:\s*\r?\n(?:^[ \t].*\r?\n)*?^[ \t]+src:\s*["']([^"']+)["']/m)?.[1] ?? '';
}

const bySrc = new Map();
for (const file of readdirSync(CONTENT_DIR).filter((entry) => entry.endsWith('.md'))) {
  const raw = readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  if (/^draft:\s*true/m.test(raw)) continue;
  const src = readHeroSrc(raw);
  if (!src) continue;
  const record = bySrc.get(src) ?? { src, series: new Set(), files: [] };
  record.series.add(readField(raw, 'series'));
  record.files.push(file);
  bySrc.set(src, record);
}

const results = [];
for (const record of bySrc.values()) {
  const absolute = path.join(PUBLIC_DIR, record.src.replace(/^\//, ''));
  if (!existsSync(absolute)) {
    results.push({ series: [...record.series].join(','), src: record.src, result: 'MISSING' });
    continue;
  }

  const image = sharp(absolute);
  const meta = await image.metadata();
  const trimmed = await image.clone().trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
  const width = meta.width ?? 1;
  const height = meta.height ?? 1;
  const trimWidth = trimmed.info.width;
  const trimHeight = trimmed.info.height;
  results.push({
    series: [...record.series].filter(Boolean).join(','),
    src: record.src,
    result: `${width}x${height} -> ${trimWidth}x${trimHeight}`,
    alpha: Boolean(meta.hasAlpha),
    widthFill: trimWidth / width,
    heightFill: trimHeight / height,
    areaFill: (trimWidth * trimHeight) / (width * height),
  });
}

results.sort((a, b) => a.series.localeCompare(b.series) || a.src.localeCompare(b.src));
for (const row of results) {
  if (row.result === 'MISSING') {
    console.log(`${row.series.padEnd(9)} MISSING ${row.src}`);
    continue;
  }
  console.log(
    `${row.series.padEnd(9)} ${row.result.padEnd(27)} ` +
    `alpha=${String(row.alpha).padEnd(5)} ` +
    `fill=${Math.round(row.widthFill * 100)}%x${Math.round(row.heightFill * 100)}% ` +
    `area=${Math.round(row.areaFill * 100)}%  ${row.src}`
  );
}
