// Builds the BUXENA brand OG card (1200×630) from APPROVED assets only:
// ember-brown ground + the approved champagne logo, nothing external.
import sharp from 'sharp';
import path from 'node:path';

const ROOT = 'C:/Users/valen/OneDrive/Documents/Projects/bux-v2';
const LOGO = path.join(ROOT, 'public/brand/buxena-logo-champagne.png');
const OUT = path.join(ROOT, 'public/images/og-brand-card.jpg');

const W = 1200, H = 630;

// Warm ember ground with a subtle radial glow, as SVG.
const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="58%" r="75%">
      <stop offset="0%" stop-color="#2a2622"/>
      <stop offset="100%" stop-color="#1b1917"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#9c7a4a"/>
</svg>`);

const logoMeta = await sharp(LOGO).metadata();
const logoW = 640;
const logoH = Math.round((logoMeta.height / logoMeta.width) * logoW);
const logo = await sharp(LOGO).resize({ width: logoW }).toBuffer();

await sharp(bg)
  .composite([{ input: logo, left: Math.round((W - logoW) / 2), top: Math.round((H - logoH) / 2) }])
  .jpeg({ quality: 88 })
  .toFile(OUT);

console.log('written:', OUT, `${logoW}x${logoH} logo on ${W}x${H}`);
