import sharp from 'sharp';

// The supplied ALLA H1 cutout has a hard 0/255 alpha mask.  Smooth only that
// mask; RGB product pixels remain untouched, so this does not alter the model.
const input = 'public/images/saunas-normalized/alla-h1-transparent.png';
const output = 'public/images/saunas-normalized/alla-h1-transparent-antialiased.png';

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const pixels = info.width * info.height;
const rgb = Buffer.alloc(pixels * 3);
const alpha = Buffer.alloc(pixels);

for (let pixel = 0; pixel < pixels; pixel += 1) {
  const source = pixel * 4;
  const destination = pixel * 3;
  rgb[destination] = data[source];
  rgb[destination + 1] = data[source + 1];
  rgb[destination + 2] = data[source + 2];
  alpha[pixel] = data[source + 3];
}

const softenedAlpha = await sharp(alpha, {
  raw: { width: info.width, height: info.height, channels: 1 },
})
  .blur(0.65)
  .raw()
  .toBuffer();

await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } })
  .joinChannel(softenedAlpha, { raw: { width: info.width, height: info.height, channels: 1 } })
  .png()
  .toFile(output);

console.log(`Created ${output}`);
