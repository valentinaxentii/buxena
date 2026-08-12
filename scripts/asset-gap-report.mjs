/**
 * What each supplier still owes us, grouped so it can be pasted into a request.
 *
 * Read-only. Reads the same frontmatter the site reads, so it cannot claim we
 * hold something the product pages do not show.
 *
 *   node scripts/asset-gap-report.mjs
 *
 * Series → manufacturer mapping comes from docs/master-supplier-product-status.md
 * and is stated here rather than inferred, so a wrong attribution is visible
 * and correctable instead of silently addressed to the wrong company.
 */

import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../src/content/saunas/', import.meta.url);

/** Verified in docs/master-supplier-product-status.md. */
const SERIES_SUPPLIER = {
  EDA: 'CAPRA',
  ELLA: 'CAPRA',
  ILLI: 'CAPRA',
  ALLA: 'CAPRA',
  UKU: 'CAPRA',
  AURA: 'UNIDENTIFIED',
  VIRU: 'MIXED — confirm per model',
  ITI: 'UNIDENTIFIED',
  NORD: 'UNIDENTIFIED',
};

// Sales-critical assets, in the order they are worth asking for.
const ASKS = [
  ['imagePermission', 'Written permission to publish product photography'],
  ['floorPlan', 'Floor plan'],
  ['dimensionDrawing', 'Dimensional drawing'],
  ['installationManual', 'Installation manual'],
  ['electricalGuide', 'Electrical guide / supply requirements'],
  ['foundationGuide', 'Foundation and site-preparation requirements'],
  ['installationVideo', 'Installation video'],
  ['assemblyVideo', 'Assembly video'],
  ['warrantyDocument', 'Warranty document'],
  ['threeD', '3D / CAD file or approved viewer'],
  ['packagingDimensions', 'Crated dimensions and gross weight'],
  ['unloadingInstructions', 'Unloading instructions'],
];

function frontmatter(raw) {
  // Normalize CRLF: these files are checked out with Windows line endings, and
  // an unnormalized match silently reports data we hold as missing.
  const text = raw.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}
function field(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*"?([^"\n]+)"?`, 'm'));
  return m ? m[1].trim() : '';
}
/** Status of one asset slot. Absent frontmatter means MISSING. */
function assetStatus(fm, key) {
  const block = fm.match(new RegExp(`^\\s{2}${key}:\\n((?:\\s{4}.*\\n?)*)`, 'm'));
  if (!block) return 'MISSING';
  const status = block[1].match(/^\s*status:\s*"?([A-Z_]+)"?/m);
  return status ? status[1] : 'MISSING';
}

const models = [];
for (const file of readdirSync(DIR)) {
  if (!file.endsWith('.md')) continue;
  const fm = frontmatter(readFileSync(new URL(file, DIR), 'utf8'));
  if (/^draft:\s*true/m.test(fm)) continue;
  const series = field(fm, 'series') || '—';
  models.push({
    slug: file.replace(/\.md$/, ''),
    title: field(fm, 'title'),
    series,
    supplier: SERIES_SUPPLIER[series] ?? 'UNIDENTIFIED',
    statuses: Object.fromEntries(ASKS.map(([key]) => [key, assetStatus(fm, key)])),
  });
}

const SETTLED = new Set(['VERIFIED', 'NOT_APPLICABLE', 'INTERNAL_ONLY']);

const bySupplier = new Map();
for (const m of models) {
  if (!bySupplier.has(m.supplier)) bySupplier.set(m.supplier, []);
  bySupplier.get(m.supplier).push(m);
}

console.log(`\nBUXENA — supplier asset gap report (${models.length} sellable models)`);
console.log('='.repeat(74));

for (const [supplier, list] of [...bySupplier].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${supplier} — ${list.length} model(s)`);
  console.log('-'.repeat(74));

  let anyGap = false;
  for (const [key, label] of ASKS) {
    const missing = list.filter((m) => !SETTLED.has(m.statuses[key]));
    if (missing.length === 0) continue;
    anyGap = true;
    const scope = missing.length === list.length ? 'ALL models' : `${missing.length} of ${list.length}`;
    console.log(`  ${label.padEnd(52)} ${scope}`);
  }
  if (!anyGap) console.log('  Nothing outstanding.');
}

console.log('\n' + '='.repeat(74));
console.log('Every line above is an asset we do NOT hold. Nothing here is a claim');
console.log('about the product — only about what has been sent to us.\n');
console.log('Series → supplier mapping is declared at the top of this script from');
console.log('docs/master-supplier-product-status.md. Correct it there if a series');
console.log('is reattributed, so a request never goes to the wrong company.\n');
