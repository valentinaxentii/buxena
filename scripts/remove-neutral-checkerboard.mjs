/**
 * Convert a baked light checkerboard around an isolated product into real
 * transparency without touching the product itself.
 *
 * Only near-neutral pixels connected to the outer image border are removed.
 * That border-connectivity guard is important: pale/gray details inside the
 * product remain opaque even if their colour resembles the checkerboard.
 *
 * Usage:
 *   node scripts/remove-neutral-checkerboard.mjs input.png output.png
 */
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import path from 'node:path';

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) throw new Error('Expected input and output PNG paths.');

const input = path.resolve(inputArg);
const output = path.resolve(outputArg);
if (!existsSync(input)) throw new Error(`Input not found: ${input}`);

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height } = info;
const pixelCount = width * height;
const visited = new Uint8Array(pixelCount);
const queue = new Int32Array(pixelCount);
let head = 0;
let tail = 0;

const isChecker = (pixel) => {
  const i = pixel * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  return Math.min(r, g, b) >= 220 && Math.max(r, g, b) - Math.min(r, g, b) <= 14;
};

const enqueue = (pixel) => {
  if (visited[pixel] || !isChecker(pixel)) return;
  visited[pixel] = 1;
  queue[tail++] = pixel;
};

for (let x = 0; x < width; x++) {
  enqueue(x);
  enqueue((height - 1) * width + x);
}
for (let y = 0; y < height; y++) {
  enqueue(y * width);
  enqueue(y * width + width - 1);
}

while (head < tail) {
  const pixel = queue[head++];
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  if (x > 0) enqueue(pixel - 1);
  if (x + 1 < width) enqueue(pixel + 1);
  if (y > 0) enqueue(pixel - width);
  if (y + 1 < height) enqueue(pixel + width);
}

for (let pixel = 0; pixel < pixelCount; pixel++) {
  if (visited[pixel]) data[pixel * 4 + 3] = 0;
}

await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(output);
console.log(`Removed ${tail.toLocaleString()} connected checkerboard pixels -> ${output}`);
