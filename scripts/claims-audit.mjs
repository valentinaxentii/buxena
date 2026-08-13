import fs from 'node:fs';
import path from 'node:path';

const DIST = path.join(process.cwd(), 'dist');
if (!fs.existsSync(DIST)) {
  console.error('FAIL  dist/ missing — run the production build first');
  process.exit(1);
}

const htmls = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else if (name.endsWith('.html')) htmls.push(file);
  }
})(DIST);

const forbidden = [
  { label: 'legacy Preorder claim', re: />\s*Preorder\s*</i },
  { label: 'unsupported Most Popular claim', re: /\bMost Popular\b/i },
  { label: 'unsupported Best Seller claim', re: /\bBest[ -]?Seller\b/i },
  { label: 'unsupported Bestseller claim', re: /\bBestseller\b/i },
];

const failures = [];
for (const file of htmls) {
  const html = fs.readFileSync(file, 'utf8');
  // Ignore script/style source text; this audit is about visitor-visible claims.
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  for (const rule of forbidden) {
    if (rule.re.test(visible)) failures.push(`${rule.label} ← ${path.relative(DIST, file)}`);
  }
}

if (failures.length) {
  console.error('FAIL  unsupported/stale public sales claims found:');
  failures.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}

console.log(`PASS  public claims audit (${htmls.length} HTML pages checked)`);
