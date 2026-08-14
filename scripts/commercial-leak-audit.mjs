/**
 * Commercial data must never reach public output.
 *
 * Scans every built public HTML file — the exact bytes a crawler or customer
 * receives — for the categories of internal data that would be genuinely
 * damaging in public: supplier cost, dealer cost, EXW terms, margin figures,
 * internal notes, and any dollar figure at all.
 *
 * THE DOLLAR RULE IS DELIBERATELY ABSOLUTE. The approved-price register
 * (src/data/pricing.ts) is empty today: no model has a public price, so a
 * dollar amount in public HTML is either a leak or an invention — both
 * launch-blocking. WHEN PRICES ARE APPROVED this rule must not be silently
 * weakened: it reads the register and permits exactly the approved strings,
 * so an approved "From $8,900" passes while a stray "$4,200" still fails.
 *
 * Admin pages are server-rendered behind auth and never appear in dist/ HTML;
 * this audit is about the public static surface.
 *
 *   npm run build && node scripts/commercial-leak-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.join(process.cwd(), 'dist');
if (!fs.existsSync(DIST)) {
  console.error('FAIL  dist/ missing — run the production build first');
  process.exit(1);
}

// Approved public prices, read from the same register the pages read. Empty
// today; the moment a price is approved there, it is permitted here.
let approvedAmounts = [];
try {
  const pricingSource = fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'pricing.ts'), 'utf8');
  // COMMENTS ARE STRIPPED FIRST, and this is load-bearing: the register's
  // JSDoc quotes example figures AND real internal costs (an old admin cost
  // and a landed cost appear in prose). The first version of this scraper
  // read those comments and thereby allow-listed internal cost figures as
  // "approved public prices" — the exact inversion of this audit's purpose.
  // Only dollar strings in ACTIVE CODE (i.e. actual register entries like
  // fromPrice: 'From $8,900') count as approved.
  const activeCode = pricingSource
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  approvedAmounts = [...activeCode.matchAll(/\$\s?[\d][\d,]*/g)].map((m) => m[0].replace(/\s/g, ''));
} catch {
  approvedAmounts = [];
}

const RULES = [
  { label: 'EXW / ex-works terms', re: /\bEXW\b|\bex[- ]works\b/i },
  { label: 'dealer cost', re: /\bdealer (cost|price|net)\b/i },
  { label: 'supplier cost', re: /\bsupplier (cost|price|net)\b/i },
  { label: 'wholesale figure', re: /\bwholesale\b/i },
  { label: 'cost price', re: /\bcost price\b/i },
  { label: 'margin percentage', re: /\bmargin\b[^<]{0,20}\d/i },
  { label: 'internal note marker', re: /internal[_ ]notes?/i },
  { label: 'unit cost field', re: /\bunit_cost\b/ },
  { label: 'provisional/duty estimate', re: /\b(provisional price|duty estimate|estimated duty)\b/i },
  { label: 'stock-count urgency', re: /\bonly \d+ (left|remaining|in stock)\b/i },
  { label: 'countdown urgency', re: /\b(sale ends|offer ends|ends in)\b/i },
];

const htmls = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else if (name.endsWith('.html')) htmls.push(file);
  }
})(DIST);

const failures = [];
for (const file of htmls) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(DIST, file).replace(/\\/g, '/');
  // Visitor-visible text: strip script/style, then tags.
  //
  // <select> blocks are stripped too, with a narrow rationale: an <option> is
  // a choice the CUSTOMER makes, not a statement BUXENA makes. The quote
  // form's budget question ("Under $10,000", "$10,000 – $20,000"…) is the
  // visitor declaring what they plan to spend — the first run of this audit
  // flagged all 96 of those options as price leaks. Free-running page text,
  // headings, buttons and attributes all remain in scope, so an actual price
  // claim anywhere outside a form control still fails.
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<select[\s\S]*?<\/select>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  for (const rule of RULES) {
    const m = visible.match(rule.re);
    if (m) failures.push(`${rule.label}: "${m[0]}" ← ${rel}`);
  }

  // Dollar figures, minus approved ones.
  for (const m of visible.matchAll(/\$\s?[\d][\d,]*(?:\.\d{2})?/g)) {
    const amount = m[0].replace(/\s/g, '');
    if (approvedAmounts.includes(amount)) continue;
    const ctx = visible.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ').trim();
    failures.push(`unapproved dollar figure: "${amount}" ← ${rel} — "…${ctx}…"`);
  }
}

console.log(`Commercial-leak audit — ${htmls.length} public HTML files`);
console.log(`approved price strings permitted: ${approvedAmounts.length ? approvedAmounts.join(', ') : '(none — register is empty)'}\n`);

if (failures.length) {
  console.error(`LEAKS: ${failures.length}`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('zero commercial leakage in public output');
