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

const blocked = fs.readFileSync(BLOCKLIST, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

const htmls = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else if (name.endsWith('.html')) htmls.push(file);
  }
})(DIST);

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

if (hits.length) {
  console.error(`FAIL  ${hits.length} rights-blocked image(s) are still referenced by the production build:`);
  for (const hit of hits) console.error(`  ${hit.image} ← ${hit.page}`);
  console.error('\nResolve by obtaining written rights for the exact use and updating the rights register/blocklist, or replace/remove the asset.');
  process.exit(1);
}

console.log(`PASS  no rights-blocked images referenced (${blocked.length} blocked paths checked across ${htmls.length} HTML pages)`);
