import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const BLOCKLIST = path.join(ROOT, 'docs', 'blocked-public-images.txt');

if (!fs.existsSync(BLOCKLIST)) {
  console.error('FAIL  blocked-public-images.txt is missing');
  process.exit(1);
}

if (!fs.existsSync(DIST)) {
  console.error('FAIL  dist/ is missing — run the production build first');
  process.exit(1);
}

// Two severities, per the founder ruling of 2026-08-13.
//   [LAUNCH-BLOCKED] no identifiable owner -> must not be in the build; FAILS.
//   [ADS-BLOCKED]    supplier-owned and identifiable -> website use accepted,
//                    paid advertising still needs written permission; REPORTED.
// A path appearing before any marker is treated as launch-blocking, so an
// un-sectioned list keeps exactly its original meaning.
const blocked = [];
const adsBlocked = [];
{
  let bucket = blocked;
  const raw_lines = fs.readFileSync(BLOCKLIST, 'utf8').split(String.fromCharCode(10));
  for (const raw0 of raw_lines) {
    const raw = raw0.replace(String.fromCharCode(13), '');
    const line = raw.trim();
    if (line === '[LAUNCH-BLOCKED]') { bucket = blocked; continue; }
    if (line === '[ADS-BLOCKED]') { bucket = adsBlocked; continue; }
    if (!line || line.startsWith('#')) continue;
    bucket.push(line);
  }
}

const htmls = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else if (name.endsWith('.html')) htmls.push(file);
  }
})(DIST);

const adsHits = [];
for (const image of adsBlocked) {
  for (const file of htmls) {
    if (fs.readFileSync(file, 'utf8').includes(image)) {
      adsHits.push({ image, page: path.relative(DIST, file) });
      break;
    }
  }
}

const hits = [];
for (const image of blocked) {
  for (const file of htmls) {
    const html = fs.readFileSync(file, 'utf8');
    if (html.includes(image)) {
      hits.push({ image, page: path.relative(DIST, file) });
      break;
    }
  }
}

if (adsHits.length) {
  console.log(`NOTE  ${adsHits.length} image(s) are cleared for the website but NOT for paid advertising:`);
  for (const hit of adsHits) console.log(`  ${hit.image}`);
  console.log('      PAID-ADVERTISING BLOCKED until written permission is recorded.');
  console.log('');
}

if (hits.length) {
  console.error(`FAIL  ${hits.length} rights-blocked image(s) are still referenced by the production build:`);
  for (const hit of hits) console.error(`  ${hit.image} ← ${hit.page}`);
  console.error('\nResolve by obtaining written rights for the exact use and updating the rights register/blocklist, or replace/remove the asset.');
  process.exit(1);
}

console.log(`PASS  no rights-blocked images referenced (${blocked.length} blocked paths checked across ${htmls.length} HTML pages)`);
