import sharp from 'sharp';

const visualRoot = 'C:/Users/valen/.codex/visualizations/2026/08/17/01a01089-c3f4-7211-a04c-f0eb0ba5bb77';
const beforePath = `${visualRoot}/proposal-before-refinement-start.png`;
const afterPath = `${visualRoot}/proposal-after-refinement-top.png`;
const outputPath = `${visualRoot}/proposal-refinement-comparison.png`;

const [before, after] = await Promise.all([
  sharp(beforePath).resize(608, 454, { fit: 'cover', position: 'top' }).png().toBuffer(),
  sharp(afterPath).resize(608, 454, { fit: 'cover', position: 'top' }).png().toBuffer(),
]);

const labels = Buffer.from(`
  <svg width="1216" height="36" xmlns="http://www.w3.org/2000/svg">
    <rect width="1216" height="36" fill="#211d19"/>
    <text x="20" y="24" fill="#fff" font-family="Arial" font-size="14">BEFORE</text>
    <text x="628" y="24" fill="#fff" font-family="Arial" font-size="14">AFTER</text>
  </svg>
`);

await sharp({
  create: { width: 1216, height: 490, channels: 3, background: '#211d19' },
})
  .composite([
    { input: labels, top: 0, left: 0 },
    { input: before, top: 36, left: 0 },
    { input: after, top: 36, left: 608 },
  ])
  .png()
  .toFile(outputPath);

console.log(outputPath);
