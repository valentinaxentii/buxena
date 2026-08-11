import sharp from 'sharp';
for (const f of ['ella-h2-indoor-cutout', 'aapo-spruce-cutout']) {
  const p = `public/images/supplier-capra/${f}.png`;
  const buf = await sharp(p).resize({ width: 1600, withoutEnlargement: true }).png({ compressionLevel: 9, palette: true }).toBuffer();
  await sharp(buf).toFile(p);
  console.log(f, '→', Math.round(buf.length / 1024), 'KB');
}
