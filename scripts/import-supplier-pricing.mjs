/**
 * BUXENA — supplier pricing import.
 *
 *   1. Paste the supplier's price list into  docs/inbox/<supplier>-pricelist.txt
 *   2. node scripts/import-supplier-pricing.mjs docs/inbox/capra-pricelist.txt
 *   3. Review the proposed changes, then re-run with --apply
 *
 * Accepts loose real-world formats — one model per line, EXW anywhere on it:
 *     ELLA H2 ....... 1610 EUR
 *     UKU 160, thermo alder bench, EUR 2,180
 *     EDA Nordic Spruce 2.5m  €1,870
 * Currency symbols, thousands separators and stray columns are tolerated.
 *
 * Matching is deliberately CONSERVATIVE: a line updates a model only when it
 * matches exactly one model by supplier reference or public name. Ambiguous or
 * unmatched lines are REPORTED, never guessed — a wrong EXW is worse than a
 * missing one.
 *
 * On --apply it updates src/data/model-identity.json:
 *   exwEur, exwSource → VERIFIED dealer EXW, and re-runs launch classification.
 * Then re-run scripts/container-model.mjs to see the new economics.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const file = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!file || !existsSync(file)) {
  console.error('Usage: node scripts/import-supplier-pricing.mjs <pricelist.txt> [--apply]');
  process.exit(1);
}

const ID_PATH = 'src/data/model-identity.json';
const id = JSON.parse(readFileSync(ID_PATH, 'utf8'));
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const candidates = Object.entries(id).map(([title, v]) => ({
  title, v,
  keys: [v.internalRef, v.publicName, v.supplierModel, title.replace(/^BUH-/, '')]
    .filter(Boolean).map(norm),
}));

const lines = readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const matched = [], ambiguous = [], unmatched = [];

for (const line of lines) {
  /**
   * Finding the price is the risky part: model names contain numbers too
   * ("UKU 160", "EDA 2.5m"). Rules, in order of trust:
   *   1. a number attached to a currency marker (€ / EUR) — strongest signal
   *   2. otherwise the LAST plausible number on the line, since price lists
   *      put the price in the final column
   * A number that is immediately followed by a unit (m, cm, kw, p, mm) is
   * never a price. Better to report a line as unmatched than mis-price it.
   */
  const cleanNum = (s) => Number(String(s).replace(/[ ,.](?=\d{3}\b)/g, '').replace(/,(?=\d{2}\b)/, '.'));
  const plausible = (n) => Number.isFinite(n) && n >= 200 && n <= 60000;

  let exw = null;
  const withCurrency = [...line.matchAll(/(?:€|eur)\s*([\d][\d ,.]*)|([\d][\d ,.]*)\s*(?:€|eur)\b/gi)]
    .map((m) => cleanNum(m[1] ?? m[2])).filter(plausible);
  if (withCurrency.length) {
    exw = withCurrency[withCurrency.length - 1];
  } else {
    const bare = [...line.matchAll(/(?<![\w.])(\d[\d ,.]*\d|\d{3,5})(?!\s*(?:m|cm|mm|kw|p|persons?|pers)\b)/gi)]
      .map((m) => cleanNum(m[1])).filter(plausible);
    if (bare.length) exw = bare[bare.length - 1];
  }
  if (exw === null) { unmatched.push({ line, why: 'no plausible price found' }); continue; }

  const n = norm(line);
  const hits = candidates.filter((c) => c.keys.some((k) => k.length >= 4 && n.includes(k)));
  // Prefer the longest key match — "UKU 160" should beat a bare "UKU".
  if (hits.length > 1) {
    const best = hits.map((h) => ({ h, len: Math.max(...h.keys.filter((k) => n.includes(k)).map((k) => k.length)) }))
      .sort((a, b) => b.len - a.len);
    if (best[0].len > best[1].len) { matched.push({ line, exw, target: best[0].h }); continue; }
    ambiguous.push({ line, exw, hits: hits.map((h) => h.v.code) });
    continue;
  }
  if (hits.length === 1) matched.push({ line, exw, target: hits[0] });
  else unmatched.push({ line, why: 'no model matched' });
}

console.log(`parsed ${lines.length} lines from ${file}\n`);
console.log(`MATCHED (${matched.length}):`);
for (const m of matched) {
  const prev = m.target.v.exwEur;
  const change = prev ? `€${prev} → €${m.exw}` : `€${m.exw} (new)`;
  console.log(`  ${m.target.v.code.padEnd(8)} ${m.target.v.publicName.padEnd(28)} ${change}`);
}
if (ambiguous.length) {
  console.log(`\nAMBIGUOUS — not applied, resolve by hand (${ambiguous.length}):`);
  for (const a of ambiguous) console.log(`  €${a.exw}  matches ${a.hits.join(', ')}  ← "${a.line.slice(0, 60)}"`);
}
if (unmatched.length) {
  console.log(`\nUNMATCHED (${unmatched.length}):`);
  for (const u of unmatched.slice(0, 15)) console.log(`  ${u.why}: "${u.line.slice(0, 70)}"`);
  if (unmatched.length > 15) console.log(`  …and ${unmatched.length - 15} more`);
}

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to update model-identity.json.');
  process.exit(0);
}

for (const m of matched) {
  const v = id[m.target.title];
  v.exwEur = m.exw;
  v.exwSource = `VERIFIED dealer EXW — imported from ${file} on ${new Date().toISOString().slice(0, 10)}`;
  delete v.exwListEur;
}
// Re-classify: cost is now known, so the blocker moves on.
for (const v of Object.values(id)) {
  if (v.hold) { v.launchStatus = 'HOLD'; continue; }
  if (v.launchStatus === 'SPECIAL ORDER') continue;
  if (!v.manufacturer) { v.launchStatus = 'WAITING FOR SUPPLIER'; v.launchBlocker = 'Manufacturer not identified'; }
  else if (!v.exwEur) { v.launchStatus = 'WAITING FOR COST'; v.launchBlocker = 'No dealer EXW'; }
  else if (v.imageRights !== 'CONFIRMED') { v.launchStatus = 'WAITING FOR PERMISSION'; v.launchBlocker = 'Cost verified; written image/document permission outstanding'; }
  else { v.launchStatus = 'READY'; v.launchBlocker = 'Cost and permission both confirmed'; }
}
writeFileSync(ID_PATH, JSON.stringify(id, null, 2));

const counts = {};
for (const v of Object.values(id)) counts[v.launchStatus] = (counts[v.launchStatus] ?? 0) + 1;
console.log(`\nAPPLIED. ${matched.length} models updated.`);
console.log('launch status now:', JSON.stringify(counts));
console.log('\nNext: node scripts/container-model.mjs   (recalculates all economics)');
console.log('      npm run build && node scripts/prelaunch-check.mjs');
console.log('\nPrices remain UNPUBLISHED — publishing still requires a founder-approved');
console.log('entry in src/data/pricing.ts.');
