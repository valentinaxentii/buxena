/**
 * BUXENA — supplier negotiation model.
 *
 *   node scripts/negotiation-model.mjs
 *
 * Works the economics BACKWARDS from what the U.S. market actually pays:
 *
 *   market retail  −  required gross profit  −  all non-product costs
 *   = MAXIMUM SUPPLIER EXW WE CAN PAY
 *
 * That figure is the negotiation target. Comparing it to the current EXW
 * gives the discount we must obtain — or tells us the model cannot work.
 *
 * Cost classes: VERIFIED · SUPPLIER QUOTED · THIRD-PARTY QUOTED · ASSUMED ·
 * PLACEHOLDER · UNKNOWN.  A missing cost is never zero.
 */

// ------------------------------------------------------------------ inputs
const FX = 1.15;                       // ASSUMED — unconfirmed

/**
 * DUTY — researched 2026-08-11, NOT yet broker-confirmed.
 *  · CBP ruling N304393 classifies a prefabricated sauna under HTS
 *    9406.10.0000 at 2.6% ad valorem (MFN / Column 1).
 *  · EU-origin goods are then topped up: for EU goods whose Column 1 rate is
 *    below 15%, Column 1 + reciprocal = 15% total. From 1 Jul 2026 the EU–US
 *    framework applies a 15% all-inclusive ceiling.
 * Net effect for Estonian/Lithuanian saunas: ~15% total.
 * IMPORTANT: reclassification cannot beat this — the EU ceiling applies
 * regardless of the Column 1 rate, so duty is NOT a negotiable lever.
 */
const DUTY = { rate: 0.15, class: 'RESEARCHED — broker confirmation required',
  mfn: 0.026, note: 'HTS 9406.10.0000 MFN 2.6% + EU reciprocal top-up to 15% ceiling' };

const PER_CONTAINER = {
  ocean:      { lo: 3600, hi: 3600, class: 'SUPPLIER QUOTED', note: 'Baltresto, Tallinn→NY' },
  destination:{ lo: 900,  hi: 1800, class: 'UNKNOWN' },
  broker:     { lo: 150,  hi: 400,  class: 'UNKNOWN' },
  drayage:    { lo: 600,  hi: 1200, class: 'UNKNOWN' },
};

const PER_UNIT = {
  origin:     { lo: 30, hi: 90,  class: 'UNKNOWN' },
  insurance:  { lo: 8,  hi: 25,  class: 'UNKNOWN' },
  warehouseIn:{ lo: 25, hi: 75,  class: 'UNKNOWN' },
  storage:    { lo: 20, hi: 90,  class: 'UNKNOWN' },
};

/**
 * HEATER — researched 2026-08-11.
 *  EU supplier price (workbook): Harvia Cilindro PC90E 9kW €285 ≈ $377;
 *  HUUM DROP 9kW €475 ≈ $628. BUT those are CE-marked, not UL/ETL.
 *  U.S. retail for UL/ETL equivalents: Harvia Cilindro 9kW ~$1,700–2,700;
 *  HUUM DROP 9kW ~$3,799–5,199. U.S. DEALER cost is unquoted; at typical
 *  dealer margins a UL Harvia lands roughly $850–1,600.
 *  The $750 previously modelled is therefore probably TOO LOW.
 */
const HEATER = {
  euCePlaceholder: { v: 750,  class: 'PLACEHOLDER', note: 'original allowance — CE-spec, not US-compliant' },
  usUlLow:         { v: 900,  class: 'ASSUMED', note: 'UL/ETL Harvia dealer cost, low end — UNQUOTED' },
  usUlHigh:        { v: 1600, class: 'ASSUMED', note: 'UL/ETL Harvia dealer cost, high end — UNQUOTED' },
};

const PCT_OF_SALE = { payment: 0.029, damageLo: 0.01, damageHi: 0.03 }; // ASSUMED / UNKNOWN
const CAC = { lo: 300, mid: 600, hi: 1000, class: 'UNKNOWN' };

const MODELS = {
  'UKU 230': { code: 'BUH-11', exw: 2240, market: 7071, seg: '4p cube',
    ceiling: 'Leil Dice Comfy 2M $7,491 · SaunaLife CL5G $7,304q · CL4G pkg $6,839q · Dice Pocket $6,611' },
  'UKU 160': { code: 'BUH-10', exw: 1930, market: 6199, seg: '2–3p cube',
    ceiling: 'Sauna Company G2 pkg $6,839q · BSaunas 1414 $6,990 · Redwood Cove $6,199q · CL3G $5,554q' },
  'ELLA':    { code: 'BUH-01', exw: 1610, market: 5244, seg: '1–2p indoor',
    ceiling: 'Golden Designs Sundsvall $7,999 · AH Hillsboro $5,299 · SunRay Baldwin $5,244 · AH Spectacle $4,658' },
};

const UNITS = 24;
const m0 = (n) => '$' + Math.round(n).toLocaleString();
const e0 = (n) => '€' + Math.round(n).toLocaleString();
const pc = (n) => (n * 100).toFixed(1) + '%';

const side = (o, s) => (o.v !== undefined ? o.v : s === 'lo' ? o.lo : o.hi);
const nonProductPerUnit = (s, cac, heater) =>
  (side(PER_CONTAINER.ocean, s) + side(PER_CONTAINER.destination, s) + side(PER_CONTAINER.broker, s) + side(PER_CONTAINER.drayage, s)) / UNITS
  + side(PER_UNIT.origin, s) + side(PER_UNIT.insurance, s) + side(PER_UNIT.warehouseIn, s) + side(PER_UNIT.storage, s)
  + cac + heater;
const saleRate = (s) => PCT_OF_SALE.payment + (s === 'lo' ? PCT_OF_SALE.damageLo : PCT_OF_SALE.damageHi);

/** Maximum EXW (EUR) payable at a target margin. */
function maxExw(model, margin, s, cac, heater) {
  const budget = model.market * (1 - margin - saleRate(s));   // total cost we can afford
  const exwUsd = (budget - nonProductPerUnit(s, cac, heater)) / (1 + DUTY.rate);
  return exwUsd / FX;
}

console.log('BUXENA — SUPPLIER NEGOTIATION MODEL\n');
console.log('DUTY: ' + DUTY.note);
console.log('      → ' + pc(DUTY.rate) + ' total. Class: ' + DUTY.class);
console.log('      Reclassification cannot reduce this: the EU ceiling applies regardless\n');

// -------------------------------------------------- 1. cost stack audit
console.log('═══ 1 · COST STACK, PER UNIT @ 24 UNITS ═══\n');
console.log('  line                     low        high     class');
const stack = [
  ['ocean freight /24', PER_CONTAINER.ocean.lo / UNITS, PER_CONTAINER.ocean.hi / UNITS, 'SUPPLIER QUOTED'],
  ['destination chg /24', PER_CONTAINER.destination.lo / UNITS, PER_CONTAINER.destination.hi / UNITS, 'UNKNOWN'],
  ['customs broker /24', PER_CONTAINER.broker.lo / UNITS, PER_CONTAINER.broker.hi / UNITS, 'UNKNOWN'],
  ['drayage /24', PER_CONTAINER.drayage.lo / UNITS, PER_CONTAINER.drayage.hi / UNITS, 'UNKNOWN'],
  ['origin transport', PER_UNIT.origin.lo, PER_UNIT.origin.hi, 'UNKNOWN'],
  ['marine insurance', PER_UNIT.insurance.lo, PER_UNIT.insurance.hi, 'UNKNOWN'],
  ['warehouse receiving', PER_UNIT.warehouseIn.lo, PER_UNIT.warehouseIn.hi, 'UNKNOWN'],
  ['storage', PER_UNIT.storage.lo, PER_UNIT.storage.hi, 'UNKNOWN'],
  ['heater (UL/ETL, US)', HEATER.usUlLow.v, HEATER.usUlHigh.v, 'ASSUMED — unquoted'],
  ['customer acquisition', CAC.lo, CAC.hi, 'UNKNOWN'],
];
for (const [l, a, b, c] of stack) console.log(`  ${l.padEnd(22)}${m0(a).padStart(9)}${m0(b).padStart(11)}     ${c}`);
console.log(`  ${'EXW (per model)'.padEnd(22)}${'—'.padStart(9)}${'—'.padStart(11)}     VERIFIED (workbook)`);
console.log(`  ${'duty'.padEnd(22)}${pc(DUTY.rate).padStart(9)}${pc(DUTY.rate).padStart(11)}     ${DUTY.class}`);
console.log(`  ${'payment + damage'.padEnd(22)}${pc(saleRate('lo')).padStart(9)}${pc(saleRate('hi')).padStart(11)}     ASSUMED / UNKNOWN`);
console.log(`\n  non-product cost per unit: ${m0(nonProductPerUnit('lo', CAC.lo, HEATER.usUlLow.v))}–${m0(nonProductPerUnit('hi', CAC.hi, HEATER.usUlHigh.v))}`);

// ---------------------------------------- 2. why the 40% gap exists
console.log('\n═══ 2 · WHY UKU 230 CANNOT REACH 40% AT MARKET PRICE ═══\n');
{
  const m = MODELS['UKU 230'];
  const exwUsd = m.exw * FX;
  const duty = exwUsd * DUTY.rate;
  const np = nonProductPerUnit('hi', CAC.mid, HEATER.usUlHigh.v);
  const cost = exwUsd + duty + np;
  const need = cost / (1 - 0.40 - saleRate('hi'));
  console.log(`  market retail                 ${m0(m.market)}`);
  console.log(`  EXW €${m.exw} → ${m0(exwUsd)}          ${pc(exwUsd / need)} of required retail`);
  console.log(`  duty 15%                      ${m0(duty)}`);
  console.log(`  heater (UL, high)             ${m0(HEATER.usUlHigh.v)}`);
  console.log(`  CAC (mid)                     ${m0(CAC.mid)}`);
  console.log(`  freight/port/handling         ${m0(np - HEATER.usUlHigh.v - CAC.mid)}`);
  console.log(`  → total cost                  ${m0(cost)}`);
  console.log(`  retail needed for 40%         ${m0(need)}`);
  console.log(`  GAP vs market                 ${m0(need - m.market)}  (${pc((need - m.market) / m.market)} above market)\n`);
  console.log('  Biggest contributors to the gap, largest first:');
  const parts = [['EXW + its duty', exwUsd + duty], ['heater', HEATER.usUlHigh.v], ['CAC', CAC.mid],
    ['freight/port/handling', np - HEATER.usUlHigh.v - CAC.mid]];
  parts.sort((a, b) => b[1] - a[1]).forEach(([n, v]) => console.log(`     ${n.padEnd(24)} ${m0(v).padStart(8)}  ${pc(v / cost)} of cost`));
}

// ------------------------------------------- 3. NEGOTIATION TABLE
console.log('\n═══ 3 · NEGOTIATION TABLE — MAXIMUM EXW WE CAN PAY ═══');
console.log('   (worst-case unknowns, CAC $600, UL heater $1,600 — the defensible planning case)\n');
console.log('  model      current   max@30%   max@35%   max@40%   max@45%   market   discount for 35%');
for (const [name, m] of Object.entries(MODELS)) {
  const cells = [0.30, 0.35, 0.40, 0.45].map((t) => {
    const v = maxExw(m, t, 'hi', CAC.mid, HEATER.usUlHigh.v);
    return (v > 0 ? e0(v) : 'impossible').padStart(10);
  });
  const at35 = maxExw(m, 0.35, 'hi', CAC.mid, HEATER.usUlHigh.v);
  const disc = at35 > 0 ? pc(Math.max(0, (m.exw - at35) / m.exw)) : 'n/a';
  console.log(`  ${name.padEnd(10)}${e0(m.exw).padStart(8)}${cells.join('')}${m0(m.market).padStart(9)}   ${disc}`);
}

console.log('\n  Best case (unknowns low, CAC $300, UL heater $900):\n');
console.log('  model      current   max@30%   max@35%   max@40%   max@45%   discount for 40%');
for (const [name, m] of Object.entries(MODELS)) {
  const cells = [0.30, 0.35, 0.40, 0.45].map((t) => {
    const v = maxExw(m, t, 'lo', CAC.lo, HEATER.usUlLow.v);
    return (v > 0 ? e0(v) : 'impossible').padStart(10);
  });
  const at40 = maxExw(m, 0.40, 'lo', CAC.lo, HEATER.usUlLow.v);
  const disc = at40 > 0 ? pc(Math.max(0, (m.exw - at40) / m.exw)) : 'n/a';
  console.log(`  ${name.padEnd(10)}${e0(m.exw).padStart(8)}${cells.join('')}   ${disc}`);
}

// ------------------------------------------- 4. heater sourcing
console.log('\n═══ 4 · HEATER: EU-SUPPLIED vs US-SOURCED ═══\n');
console.log('  EU supplier price (workbook):  Harvia Cilindro PC90E 9kW €285 ≈ $377');
console.log('                                 HUUM DROP 9kW €475 ≈ $628');
console.log('  BUT these are CE-marked, not UL/ETL — not compliant for US sale.');
console.log('  US retail (researched):        Harvia Cilindro 9kW ~$1,700–2,700');
console.log('                                 HUUM DROP 9kW ~$3,799–5,199');
console.log('  US dealer cost:                UNQUOTED — planning $900–1,600\n');
console.log('  Verdict: importing CE heaters is cheaper on paper but carries');
console.log('  compliance risk (UL/ETL is expected by US buyers, inspectors and');
console.log('  insurers) — and the saving is not the $377-vs-$1,600 headline,');
console.log('  because a US-sourced heater also removes it from container volume,');
console.log('  duty base and damage exposure. Get a US dealer quote before deciding.');
console.log('  Heater is ' + pc(HEATER.usUlHigh.v / (MODELS['UKU 230'].market)) + ' of UKU 230 retail — material, not marginal.');

// ------------------------------------------- 5. price ceilings
console.log('\n═══ 5 · U.S. PRICE CEILING BY MODEL (verified competitor set) ═══\n');
for (const [name, m] of Object.entries(MODELS)) {
  console.log(`  ${name} — ${m.seg}, market median ${m0(m.market)}`);
  console.log(`     ${m.ceiling}\n`);
}
console.log('  q = private email quote; others advertised. Heater INCLUDED in the');
console.log('  traditional retailers (Almost Heaven, My Sauna World, Redwood, Sauna');
console.log('  Company); NOT included by BSaunas and LEXLETIX.');

console.log('\nNo price here is approved for publication. Not a purchase order.');
