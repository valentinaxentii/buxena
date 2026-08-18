/**
 * Turn a supplier product render on a connected white/cream canvas into a
 * transparent PNG while preserving the original product pixels.
 *
 * The extractor deliberately starts at the image border, so pale wood inside
 * the sauna is not removed merely because it resembles the backdrop. After
 * the border flood, only the largest remaining connected component is kept;
 * this drops detached supplier logos and scan specks.
 *
 * Usage:
 *   node scripts/extract-light-canvas.mjs input.jpg output.png
 */
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import path from 'node:path';

const [, , inputArg, outputArg, lightFloorArg] = process.argv;
if (!inputArg || !outputArg) throw new Error('Expected input and output paths.');

const input = path.resolve(inputArg);
const output = path.resolve(outputArg);
const lightFloor = Number(lightFloorArg ?? 205);
if (!Number.isFinite(lightFloor) || lightFloor < 0 || lightFloor > 255) {
  throw new Error('Optional light-floor value must be between 0 and 255.');
}
if (!existsSync(input)) throw new Error(`Input not found: ${input}`);

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height } = info;
const pixelCount = width * height;
const background = new Uint8Array(pixelCount);
const queue = new Int32Array(pixelCount);
let head = 0;
let tail = 0;

const isLightCanvas = (pixel) => {
  const i = pixel * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);

  // Covers white JPEG canvas, warm ivory catalogue paper, and the pale gold
  // diagonal artwork used in Capra's supplier sheets.
  return min >= lightFloor && max - min <= 68;
};

const enqueueBackground = (pixel) => {
  if (background[pixel] || !isLightCanvas(pixel)) return;
  background[pixel] = 1;
  queue[tail++] = pixel;
};

for (let x = 0; x < width; x++) {
  enqueueBackground(x);
  enqueueBackground((height - 1) * width + x);
}
for (let y = 0; y < height; y++) {
  enqueueBackground(y * width);
  enqueueBackground(y * width + width - 1);
}

while (head < tail) {
  const pixel = queue[head++];
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  if (x > 0) enqueueBackground(pixel - 1);
  if (x + 1 < width) enqueueBackground(pixel + 1);
  if (y > 0) enqueueBackground(pixel - width);
  if (y + 1 < height) enqueueBackground(pixel + width);
}

for (let pixel = 0; pixel < pixelCount; pixel++) {
  if (background[pixel]) data[pixel * 4 + 3] = 0;
}

// Keep only the largest foreground island. This removes detached logos and
// catalogue marks without guessing at their colours.
const seen = new Uint8Array(pixelCount);
let largest = [];
const componentQueue = new Int32Array(pixelCount);

for (let start = 0; start < pixelCount; start++) {
  if (seen[start] || data[start * 4 + 3] === 0) continue;

  let componentHead = 0;
  let componentTail = 0;
  const component = [];
  seen[start] = 1;
  componentQueue[componentTail++] = start;

  while (componentHead < componentTail) {
    const pixel = componentQueue[componentHead++];
    component.push(pixel);
    const x = pixel % width;
    const y = Math.floor(pixel / width);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (seen[next] || data[next * 4 + 3] === 0) continue;
        seen[next] = 1;
        componentQueue[componentTail++] = next;
      }
    }
  }

  if (component.length > largest.length) largest = component;
}

const keep = new Uint8Array(pixelCount);
for (const pixel of largest) keep[pixel] = 1;
for (let pixel = 0; pixel < pixelCount; pixel++) {
  if (!keep[pixel]) data[pixel * 4 + 3] = 0;
}

await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(output);
console.log(
  `Extracted ${largest.length.toLocaleString()} product pixels from ${width}x${height} -> ${output}`,
);
