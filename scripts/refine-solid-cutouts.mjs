/** Preserve two transparent/glass models whose surfaces confuse segmentation. */
import sharp from 'sharp';
import path from 'node:path';

const jobs = [
  {
    input: 'nord-cube-240-hero.jpg',
    output: 'nord-cube-240-transparent.png',
    shapes: `<path d="M330 410L880 332L1272 427L1265 1138L1082 1204L342 1150Z"/><path d="M342 1100H392V1206H342ZM542 1120H592V1225H542ZM846 1160H902V1255H846ZM1080 1140H1136V1225H1080ZM1220 1095H1272V1187H1220Z"/>`,
  },
  {
    input: 'viru-vertical-2-6m-hero.jpg',
    output: 'viru-vertical-2-6m-transparent.png',
    shapes: `<path d="M151 159L270 86L438 156L438 188L425 194L426 432Q418 469 299 482Q181 474 164 442L166 191L151 187Z"/><path d="M253 55H280V115H253Z"/>`,
  },
];

for (const job of jobs) {
  const input = path.resolve('public/images/saunas', job.input);
  const output = path.resolve('public/images/saunas-normalized', job.output);
  const metadata = await sharp(input).metadata();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${metadata.width}" height="${metadata.height}" viewBox="0 0 ${metadata.width} ${metadata.height}"><g fill="white">${job.shapes}</g></svg>`,
  );
  const cutout = await sharp(input)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  const longest = Math.max(cutout.info.width, cutout.info.height);
  const padding = Math.max(20, Math.round(longest * 0.08));
  const side = longest + padding * 2;
  const left = Math.floor((side - cutout.info.width) / 2);
  const top = Math.floor((side - cutout.info.height) / 2);
  await sharp(cutout.data)
    .extend({
      left,
      right: side - cutout.info.width - left,
      top,
      bottom: side - cutout.info.height - top,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(output);
  console.log(`${job.input} -> ${job.output}`);
}
