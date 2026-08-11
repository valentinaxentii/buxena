/**
 * BUXENA — first-container decision model.
 *
 *   node scripts/container-model.mjs            full report
 *   node scripts/container-model.mjs --brief    headline numbers only
 *
 * ========================= COST DISCIPLINE (READ) =========================
 * A missing cost is NEVER treated as zero. Every line is one of:
 *
 *   VERIFIED  a real quote or supplier document          → single value
 *   ASSUMED   a stated assumption we have not confirmed   → single value, flagged
 *   UNKNOWN   we have no number                           → PLANNING BAND (lo–hi)
 *
 * UNKNOWN lines are given a planning band so a decision can be modelled at
 * all. Those bands are NOT data — they are placeholders that must be replaced
 * by quotes before any PO. Every output therefore appears as a RANGE:
 *   BEST  = every unknown lands at the low end
 *   WORST = every unknown lands at the high end
 * A single-point "answer" would be false precision, so none is given.
 *
 * Edit SCENARIO/MIX and re-run; everything recalculates.
 * NOT A PURCHASE ORDER.
 */
const BRIEF = process.argv.includes('--brief');

// ---------------------------------------------------------------- inputs
const FX = { v: 1.15, class: 'ASSUMED', note: 'EUR→USD — unconfirmed, verify at order date' };

const PER_CONTAINER = {
  oceanFreight:   { v: 3600, class: 'VERIFIED', note: 'Baltresto quote, Tallinn→NY' },
  destinationChg: { lo: 900, hi: 1800, class: 'UNKNOWN', note: 'Terminal handling / destination charges — no quote' },
  customsBroker:  { lo: 150, hi: 400,  class: 'UNKNOWN', note: 'Entry + bond + MPF/HMF — no quote' },
  drayage:        { lo: 600, hi: 1200, class: 'UNKNOWN', note: 'Port→warehouse haulage — no quote' },
};

const PER_UNIT = {
  heater:         { v: 750, class: 'ASSUMED', note: 'UL/ETL allowance — no heater selected or priced' },
  originTransport:{ lo: 30,  hi: 90,  class: 'UNKNOWN', note: 'Factory→port haulage' },
  marineInsurance:{ lo: 8,   hi: 25,  class: 'UNKNOWN', note: 'Typically % of CIF' },
  warehouseIn:    { lo: 25,  hi: 75,  class: 'UNKNOWN', note: 'Receiving and handling' },
  storage:        { lo: 20,  hi: 90,  class: 'UNKNOWN', note: 'Depends on sell-through — see sensitivity' },
};

const PCT_OF_SALE = {
  duty:           { v: 0.15, class: 'ASSUMED', note: 'Of EXW-USD. HS code and dutiable basis unconfirmed' },
  paymentFees:    { v: 0.029, class: 'ASSUMED', note: 'Card processing' },
  damageReserve:  { lo: 0.01, hi: 0.03, class: 'UNKNOWN', note: 'Damage/warranty reserve — no policy set' },
};

const CAC = { lo: 300, hi: 1000, mid: 600, class: 'UNKNOWN', note: 'Cost per acquired sale — no ad spend data yet' };

// Crate volume: NOT SUPPLIED by any supplier yet — freight is allocated by
// unit count, which over-charges small models and under-charges large ones.
const CRATE_VOLUME = { class: 'UNKNOWN', note: 'Crate dimensions/weights requested from all three suppliers' };

const MODELS = {
  'UKU 230': { code: 'BUH-11', supplier: 'CAPRA', exw: 2240, exwClass: 'VERIFIED', market: 7071, seg: '4p cube' },
  'UKU 160': { code: 'BUH-10', supplier: 'CAPRA', exw: 1930, exwClass: 'VERIFIED', market: 6199, seg: '2–3p cube' },
  'ELLA':    { code: 'BUH-01', supplier: 'CAPRA', exw: 1610, exwClass: 'VERIFIED', market: 5244, seg: '1–2p indoor' },
};

// Recommended Phase 1 STOCK mix — only models with VERIFIED dealer EXW.
const MIX = { 'UKU 230': 10, 'UKU 160': 8, 'ELLA': 6 };

// ------------------------------------------------------------ calculation
const m0 = (n) => '$' + Math.round(n).toLocaleString();
const pc = (n) => (n * 100).toFixed(1) + '%';
const band = (lo, hi) => `${m0(lo)}–${m0(hi)}`;

const lo = (x) => (x.v !== undefined ? x.v : x.lo);
const hi = (x) => (x.v !== undefined ? x.v : x.hi);

function unitCost(model, units, side, cacSide) {
  const pick = side === 'lo' ? lo : hi;
  const exwUsd = model.exw * FX.v;
  const duty = exwUsd * PCT_OF_SALE.duty.v;
  const containerTotal = pick(PER_CONTAINER.oceanFreight) + pick(PER_CONTAINER.destinationChg)
    + pick(PER_CONTAINER.customsBroker) + pick(PER_CONTAINER.drayage);
  const perUnitContainer = containerTotal / units;
  const perUnitFixed = pick(PER_UNIT.heater) + pick(PER_UNIT.originTransport)
    + pick(PER_UNIT.marineInsurance) + pick(PER_UNIT.warehouseIn) + pick(PER_UNIT.storage);
  const cac = cacSide ?? (side === 'lo' ? CAC.lo : CAC.hi);
  return exwUsd + duty + perUnitContainer + perUnitFixed + cac;
}

/** %-of-sale costs applied at the selling price. */
const saleSideRate = (side) =>
  PCT_OF_SALE.paymentFees.v + (side === 'lo' ? PCT_OF_SALE.damageReserve.lo : PCT_OF_SALE.damageReserve.hi);

console.log('BUXENA — FIRST CONTAINER DECISION MODEL');
console.log('Every figure is a RANGE. BEST = unknowns at low end, WORST = at high end.');
console.log('No single-point answer is given: that would be false precision.\n');

// ---------------------------------------------------- 1. scenario table
const FILLS = [20, 22, 24, 26];
console.log('═══ 1 · CONTAINER FILL SCENARIOS (recommended mix ratio) ═══\n');
const mixUnits = Object.values(MIX).reduce((a, b) => a + b, 0);

for (const units of FILLS) {
  const ratio = units / mixUnits;
  let capLo = 0, capHi = 0, rev = 0, n = 0;
  const lines = [];
  for (const [name, qty] of Object.entries(MIX)) {
    const m = MODELS[name];
    const q = Math.round(qty * ratio);
    if (!q) continue;
    const cLo = unitCost(m, units, 'lo');
    const cHi = unitCost(m, units, 'hi');
    capLo += cLo * q; capHi += cHi * q; rev += m.market * q; n += q;
    lines.push(`     ${name.padEnd(9)} ×${String(q).padStart(2)}  ${m.supplier.padEnd(6)} EXW €${m.exw} (${m.exwClass})  true cost/unit ${band(cLo, cHi)}  retail ${m0(m.market)}`);
  }
  const gpLo = rev - capHi - rev * saleSideRate('hi');
  const gpHi = rev - capLo - rev * saleSideRate('lo');
  console.log(`  ${units}-UNIT CONTAINER (${n} placed)`);
  lines.forEach((l) => console.log(l));
  console.log(`     investment ${band(capLo, capHi)} · revenue ${m0(rev)} · gross profit ${band(gpLo, gpHi)} · margin ${pc(gpLo / rev)}–${pc(gpHi / rev)}`);
  const beLo = Math.ceil(capLo / (rev / n)), beHi = Math.ceil(capHi / (rev / n));
  console.log(`     break-even: ${beLo}–${beHi} of ${n} units sold\n`);
}

if (BRIEF) process.exit(0);

// ---------------------------------------------- 2. per-unit cost build-up
console.log('═══ 2 · PER-UNIT COST BUILD-UP (24-unit container) ═══\n');
for (const [name, m] of Object.entries(MODELS)) {
  const exwUsd = m.exw * FX.v;
  console.log(`  ${name} (${m.code}, ${m.supplier}, ${m.seg})`);
  console.log(`     EXW €${m.exw} → ${m0(exwUsd)}                         VERIFIED`);
  console.log(`     duty @15% of EXW            ${m0(exwUsd * 0.15).padStart(12)}   ASSUMED`);
  console.log(`     ocean freight /24           ${m0(PER_CONTAINER.oceanFreight.v / 24).padStart(12)}   VERIFIED`);
  console.log(`     destination charges /24     ${band(PER_CONTAINER.destinationChg.lo / 24, PER_CONTAINER.destinationChg.hi / 24).padStart(12)}   UNKNOWN`);
  console.log(`     customs broker /24          ${band(PER_CONTAINER.customsBroker.lo / 24, PER_CONTAINER.customsBroker.hi / 24).padStart(12)}   UNKNOWN`);
  console.log(`     drayage /24                 ${band(PER_CONTAINER.drayage.lo / 24, PER_CONTAINER.drayage.hi / 24).padStart(12)}   UNKNOWN`);
  console.log(`     heater allowance            ${m0(PER_UNIT.heater.v).padStart(12)}   ASSUMED`);
  console.log(`     origin transport            ${band(PER_UNIT.originTransport.lo, PER_UNIT.originTransport.hi).padStart(12)}   UNKNOWN`);
  console.log(`     marine insurance            ${band(PER_UNIT.marineInsurance.lo, PER_UNIT.marineInsurance.hi).padStart(12)}   UNKNOWN`);
  console.log(`     warehouse receiving         ${band(PER_UNIT.warehouseIn.lo, PER_UNIT.warehouseIn.hi).padStart(12)}   UNKNOWN`);
  console.log(`     storage allowance           ${band(PER_UNIT.storage.lo, PER_UNIT.storage.hi).padStart(12)}   UNKNOWN`);
  console.log(`     customer acquisition        ${band(CAC.lo, CAC.hi).padStart(12)}   UNKNOWN`);
  console.log(`     crate volume                ${'—'.padStart(12)}   UNKNOWN (freight allocated per unit, not volume)`);
  console.log(`     → TRUE COST/UNIT            ${band(unitCost(m, 24, 'lo'), unitCost(m, 24, 'hi')).padStart(12)}`);
  console.log(`       at retail ${m0(m.market)}: margin ${pc((m.market - unitCost(m, 24, 'hi') - m.market * saleSideRate('hi')) / m.market)}–${pc((m.market - unitCost(m, 24, 'lo') - m.market * saleSideRate('lo')) / m.market)}\n`);
}

// ------------------------------------------------- 3. profit sensitivity
console.log('═══ 3 · PROFIT SENSITIVITY — 24-unit container ═══\n');
console.log('  a) Required retail to hit a target margin (per unit, worst-case cost)\n');
console.log('     model        30%       35%       40%       45%       50%     vs market');
for (const [name, m] of Object.entries(MODELS)) {
  const c = unitCost(m, 24, 'hi');
  const cells = [0.30, 0.35, 0.40, 0.45, 0.50].map((t) => m0(c / (1 - t - saleSideRate('hi'))).padStart(10));
  console.log(`     ${name.padEnd(9)}${cells.join('')}   (market ${m0(m.market)})`);
}

console.log('\n  b) Discounting at market price — whole container, 24 units\n');
console.log('     discount    revenue      gross profit (best–worst)     margin');
for (const d of [0, 0.05, 0.10]) {
  let rev = 0, capLo = 0, capHi = 0;
  const ratio = 24 / mixUnits;
  for (const [name, qty] of Object.entries(MIX)) {
    const m = MODELS[name]; const q = Math.round(qty * ratio);
    rev += m.market * (1 - d) * q;
    capLo += unitCost(m, 24, 'lo') * q; capHi += unitCost(m, 24, 'hi') * q;
  }
  const gpLo = rev - capHi - rev * saleSideRate('hi');
  const gpHi = rev - capLo - rev * saleSideRate('lo');
  console.log(`     ${(d * 100).toFixed(0).padStart(3)}%     ${m0(rev).padStart(10)}     ${band(gpLo, gpHi).padStart(22)}     ${pc(gpLo / rev)}–${pc(gpHi / rev)}`);
}

console.log('\n  c) Customer acquisition cost — whole container at market price\n');
console.log('     CAC/sale    gross profit (best–worst)     margin');
for (const cac of [300, 600, 1000]) {
  let rev = 0, capLo = 0, capHi = 0;
  const ratio = 24 / mixUnits;
  for (const [name, qty] of Object.entries(MIX)) {
    const m = MODELS[name]; const q = Math.round(qty * ratio);
    rev += m.market * q;
    capLo += unitCost(m, 24, 'lo', cac) * q; capHi += unitCost(m, 24, 'hi', cac) * q;
  }
  const gpLo = rev - capHi - rev * saleSideRate('hi');
  const gpHi = rev - capLo - rev * saleSideRate('lo');
  console.log(`     ${m0(cac).padStart(7)}     ${band(gpLo, gpHi).padStart(22)}     ${pc(gpLo / rev)}–${pc(gpHi / rev)}`);
}

console.log('\n  d) Sell-through — storage cost is the only line that moves with time\n');
console.log('     Storage is UNKNOWN ($20–90/unit/period assumed). Until a warehouse rate');
console.log('     is quoted, sell-through cannot be costed honestly. What IS certain:');
console.log('     capital stays tied up until units sell, and 30 vs 120 days changes');
console.log('     cash position far more than it changes gross margin.\n');
for (const days of [30, 60, 90, 120]) {
  const months = days / 30;
  const storLo = PER_UNIT.storage.lo * months, storHi = PER_UNIT.storage.hi * months;
  console.log(`     ${String(days).padStart(3)} days → storage/unit ${band(storLo, storHi).padStart(12)}  (×24 = ${band(storLo * 24, storHi * 24)} on the container)`);
}

// ------------------------------------------------ 4. logistics checklist
console.log('\n═══ 4 · LOGISTICS INPUT CHECKLIST ═══\n');
const rows = [
  ['Tallinn→NY/NJ 40HC ocean', 'VERIFIED', '$3,600 — Baltresto quote', 'Re-confirm validity and expiry date'],
  ['Destination / terminal charges', 'UNKNOWN', `planning ${band(PER_CONTAINER.destinationChg.lo, PER_CONTAINER.destinationChg.hi)}`, 'Forwarder quote for NY/NJ'],
  ['Customs broker + bond + MPF/HMF', 'UNKNOWN', `planning ${band(PER_CONTAINER.customsBroker.lo, PER_CONTAINER.customsBroker.hi)}`, 'Broker fee schedule'],
  ['Duty rate', 'ASSUMED 15%', 'of EXW-USD', 'HS classification + dutiable basis — BIGGEST single unknown'],
  ['Drayage port→warehouse', 'UNKNOWN', `planning ${band(PER_CONTAINER.drayage.lo, PER_CONTAINER.drayage.hi)}`, 'Drayage quote'],
  ['Warehouse receiving', 'UNKNOWN', `planning ${band(PER_UNIT.warehouseIn.lo, PER_UNIT.warehouseIn.hi)}/unit`, '3PL rate card'],
  ['Storage', 'UNKNOWN', `planning ${band(PER_UNIT.storage.lo, PER_UNIT.storage.hi)}/unit/mo`, '3PL rate card'],
  ['Final-mile delivery to customer', 'EXCLUDED', 'quoted separately', 'Matches competitor practice; keep out of product margin'],
  ['Crate dimensions and weights', 'UNKNOWN', 'per model', 'Needed to allocate freight by volume instead of unit count'],
  ['Marine insurance', 'UNKNOWN', `planning ${band(PER_UNIT.marineInsurance.lo, PER_UNIT.marineInsurance.hi)}/unit`, '% of CIF from insurer'],
  ['Heater cost', 'ASSUMED', '$750/unit', 'No heater selected; UL/ETL listing required for US'],
  ['Customer acquisition cost', 'UNKNOWN', `planning ${band(CAC.lo, CAC.hi)}`, 'No ad spend data yet'],
];
for (const [item, cls, val, need] of rows) {
  console.log(`  [${cls.padEnd(12)}] ${item.padEnd(34)} ${String(val).padEnd(26)} → ${need}`);
}

console.log('\nNOT A PURCHASE ORDER. No price here is approved for publication.');
