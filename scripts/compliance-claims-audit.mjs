import fs from 'node:fs';
import path from 'node:path';

/**
 * BUXENA public compliance-claim guard.
 *
 * Electrical listing/certification claims are high-risk in the U.S. market.
 * Until exact supplier/component documentation is verified, customer-facing
 * source must not state or imply UL/ETL/CSA listing/certification or blanket
 * code/North-American compliance.
 *
 * This scans PUBLIC source only. Admin/internal docs are intentionally outside
 * the scan. If a verified claim is later approved, add the exact file + phrase
 * to a narrow allowlist rather than weakening these patterns globally.
 */

const roots = ['src/content/saunas', 'src/pages', 'src/components'];
const files = [];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      if (stat.isDirectory()) walk(file);
      else if (/\.(astro|md|mdx|ts)$/.test(name)) files.push(file);
    }
  })(root);
}

const rules = [
  { label: 'UL listing/certification claim', re: /\bUL(?:[- ]?(?:listed|certified|approved))\b/gi },
  { label: 'ETL listing/certification claim', re: /\bETL(?:[- ]?(?:listed|certified|approved))\b/gi },
  { label: 'CSA listing/certification claim', re: /\bCSA(?:[- ]?(?:listed|certified|approved))\b/gi },
  { label: 'blanket North American compliance claim', re: /\bNorth American?[- ](?:compliant|approved|certified)\b/gi },
  { label: 'blanket electrical code-compliance claim', re: /\b(?:electrical(?:ly)?|heater|sauna)\s+(?:is\s+|are\s+)?(?:code[- ]compliant|code compliant)\b/gi },
];

const failures = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    const match = rule.re.exec(text);
    if (!match) continue;
    const line = text.slice(0, match.index).split(/\r?\n/).length;
    failures.push(`${rule.label} ← ${file}:${line} — ${JSON.stringify(match[0])}`);
  }
}

if (failures.length) {
  console.error('FAIL  unverified public electrical/compliance claims found:');
  failures.forEach((f) => console.error(`  ${f}`));
  console.error('\nVerify exact documentation first; then use a narrow, evidence-backed claim rather than disabling this guard.');
  process.exit(1);
}

console.log(`PASS  public electrical/compliance claim guard (${files.length} source files checked)`);
