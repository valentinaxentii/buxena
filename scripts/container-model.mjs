/**
 * BUXENA — first-container cost model and Phase 1 planning scenario.
 *
 *   node scripts/container-model.mjs
 *
 * Calculates true landed/sold cost per unit and for a whole 40HC, then
 * derives retail, gross profit and gross margin.
 *
 * ============================ DATA DISCIPLINE ============================
 * Every input is tagged VERIFIED / ESTIMATED / UNKNOWN. Nothing is invented:
 * where a real number does not exist the line is zero and reported as a gap,
 * so the resulting cost is knowingly INCOMPLETE rather than falsely precise.
 *
 * This is a PLANNING SCENARIO, not a purchase order. Edit SCENARIO below and
 * re-run; every figure recalculates. When Capra replies, put the dealer EXW
 * into MODELS and delete the corresponding gap note.
 */

const FX = { rate: 1.15, class: 'ESTIMATED — unconfirmed, verify at order' };

// --- Per-unit cost inputs -------------------------------------------------
const COSTS = {
  dutyPct:        { v: 0.15,  class: 'ESTIMATED', note: 'HS classification and dutiable basis unconfirmed — broker to confirm' },
  oceanFreight40HC:{ v: 3600, class: 'VERIFIED',  note: 'Real Baltresto quote, Tallinn→New York' },
  portAndDrayage: { v: 2500,  class: 'ESTIMATED', note: 'Port fees + inland trucking per container — replace with forwarder quote' },
  heater:         { v: 750,   class: 'ESTIMATED', note: 'UL/ETL heater allowance — no heater selected yet' },
  originTransport:{ v: 0,     class: 'UNKNOWN',   note: 'Factory→port haulage not quoted' },
  marineInsurance:{ v: 0,     class: 'UNKNOWN',   note: 'Typically a % of CIF — not quoted' },
  customsBroker:  { v: 0,     class: 'UNKNOWN',   note: 'Entry, bond, MPF/HMF not quoted' },
  warehouseIn:    { v: 0,     class: 'UNKNOWN',   note: 'Receiving and handling not quoted' },
  storage:        { v: 0,     class: 'UNKNOWN',   note: 'Monthly storage allocation not quoted' },
  damageReserve:  { v: 0.00,  class: 'UNKNOWN',   note: 'Damage/warranty reserve as % of sale — no policy set' },
  paymentFees:    { v: 0.029, class: 'ESTIMATED', note: 'Card processing ~2.9% of sale' },
  cacPerUnit:     { v: 0,     class: 'UNKNOWN',   note: 'Advertising cost per acquired sale — no spend data yet' },
};

// --- Models --------------------------------------------------------------
// exw: dealer EXW in EUR. exwClass VERIFIED only where a dealer price exists.
// unitsPer40HC drives freight allocation.
const MODELS = {
  'BUH-10 UKU 160':  { exw: 1930, exwClass: 'VERIFIED', units40HC: 24, marketMedian: 6199, segment: '2–3p cube' },
  'BUH-11 UKU 230':  { exw: 2240, exwClass: 'VERIFIED', units40HC: 24, marketMedian: 7071, segment: '4p cube' },
  'BUH-01 ELLA':     { exw: 1610, exwClass: 'VERIFIED', units40HC: 24, marketMedian: 5244, segment: '1–2p indoor' },
  'BUH-03 ILLI':     { exw: null, exwClass: 'UNKNOWN',  units40HC: 24, marketMedian: 5547, segment: '2–3p indoor' },
  'BUH-05 ALLA':     { exw: null, exwClass: 'UNKNOWN',  units40HC: 24, marketMedian: 7290, segment: '4p indoor' },
};

// --- Phase 1 planning scenario (EDITABLE — not an order) ------------------
const SCENARIO = {
  label: 'Phase 1 — ~24 units, weighted to UKU with selected indoor',
  mix: {
    'BUH-11 UKU 230': 8,
    'BUH-10 UKU 160': 8,
    'BUH-01 ELLA':    4,
    'BUH-03 ILLI':    2,
    'BUH-05 ALLA':    2,
  },
};

// --- Calculation ---------------------------------------------------------
const money = (n) => (n == null ? '—' : '$' + Math.round(n).toLocaleString());
const pct = (n) => (n == null ? '—' : (n * 100).toFixed(1) + '%');

function unitCost(m) {
  if (m.exw == null) return null;
  const exwUsd = m.exw * FX.rate;
  const duty = exwUsd * COSTS.dutyPct.v;
  const freightPort = (COSTS.oceanFreight40HC.v + COSTS.portAndDrayage.v) / m.units40HC;
  const fixed = COSTS.originTransport.v + COSTS.marineInsurance.v + COSTS.customsBroker.v
    + COSTS.warehouseIn.v + COSTS.storage.v + COSTS.cacPerUnit.v;
  return {
    exwUsd, duty, freightPort, heater: COSTS.heater.v, fixed,
    total: exwUsd + duty + freightPort + COSTS.heater.v + fixed,
  };
}

/** Price at a target gross margin, accounting for %-of-sale costs. */
const priceAt = (cost, margin) => cost / (1 - margin - COSTS.paymentFees.v - COSTS.damageReserve.v);

console.log('BUXENA — FIRST CONTAINER COST MODEL');
console.log(`FX ${FX.rate} (${FX.class})\n`);

console.log('PER-UNIT ECONOMICS');
for (const [name, m] of Object.entries(MODELS)) {
  const c = unitCost(m);
  if (!c) { console.log(`\n${name}  [${m.segment}]  — EXW UNKNOWN, cannot cost`); continue; }
  const varPct = COSTS.paymentFees.v + COSTS.damageReserve.v;
  const atMedian = m.marketMedian;
  const gp = atMedian - c.total - atMedian * varPct;
  console.log(`\n${name}  [${m.segment}]  EXW €${m.exw} (${m.exwClass})`);
  console.log(`   EXW ${money(c.exwUsd)} + duty ${money(c.duty)} + freight/port ${money(c.freightPort)} + heater ${money(c.heater)} = ${money(c.total)}`);
  console.log(`   at market median ${money(atMedian)}: GP ${money(gp)} | margin ${pct(gp / atMedian)} | markup ${pct((atMedian - c.total) / c.total)}`);
  console.log(`   price for 40% ${money(priceAt(c.total, 0.40))} · 45% ${money(priceAt(c.total, 0.45))} · 50% ${money(priceAt(c.total, 0.50))}`);
}

console.log(`\n\nPHASE 1 SCENARIO — ${SCENARIO.label}`);
let units = 0, capital = 0, revenue = 0, costed = 0, uncosted = [];
for (const [name, qty] of Object.entries(SCENARIO.mix)) {
  const m = MODELS[name];
  units += qty;
  const c = unitCost(m);
  if (!c) { uncosted.push(`${name} ×${qty}`); continue; }
  costed += qty;
  capital += c.total * qty;
  revenue += m.marketMedian * qty;
}
const varCost = revenue * (COSTS.paymentFees.v + COSTS.damageReserve.v);
const gp = revenue - capital - varCost;
console.log(`   units planned: ${units} (${costed} costed, ${units - costed} not costable)`);
if (uncosted.length) console.log(`   NOT COSTABLE (EXW unknown): ${uncosted.join(', ')}`);
console.log(`   capital required (costed units only): ${money(capital)}`);
console.log(`   revenue at market medians:            ${money(revenue)}`);
console.log(`   gross profit:                         ${money(gp)}  |  margin ${pct(gp / revenue)}`);

// --- Container fill sensitivity ------------------------------------------
// Freight and port are per CONTAINER, so the per-unit share falls as the
// container fills. This is the single biggest controllable cost lever.
console.log('\n\nCONTAINER FILL SENSITIVITY');
console.log('   How per-unit freight+port and margin move with units loaded.');
const FILLS = [20, 22, 24, 26];
const perContainer = COSTS.oceanFreight40HC.v + COSTS.portAndDrayage.v;
console.log(`   (${money(perContainer)} per 40HC: ${money(COSTS.oceanFreight40HC.v)} ocean [VERIFIED] + ${money(COSTS.portAndDrayage.v)} port/drayage [ESTIMATED])\n`);

const header = ['model'.padEnd(18), ...FILLS.map((f) => `${f}u`.padStart(11))].join('');
console.log('   ' + header);
for (const [name, m] of Object.entries(MODELS)) {
  if (m.exw == null) continue;
  const exwUsd = m.exw * FX.rate;
  const base = exwUsd + exwUsd * COSTS.dutyPct.v + COSTS.heater.v;
  const cells = FILLS.map((f) => {
    const cost = base + perContainer / f;
    const gp = m.marketMedian - cost - m.marketMedian * COSTS.paymentFees.v;
    return `${pct(gp / m.marketMedian)}`.padStart(11);
  });
  console.log('   ' + name.replace(/^BUH-\d+ /, '').padEnd(18) + cells.join(''));
}
console.log('\n   (margin at each model\'s market median — higher fill, higher margin)');

// Whole-container capital and return at each fill level, using the scenario mix ratio.
console.log('\n   Whole-container view, Phase 1 mix ratio, costed units only:');
for (const f of FILLS) {
  const ratio = f / Object.values(SCENARIO.mix).reduce((a, b) => a + b, 0);
  let cap = 0, rev = 0, n = 0;
  for (const [name, qty] of Object.entries(SCENARIO.mix)) {
    const m = MODELS[name];
    if (m.exw == null) continue;
    const q = Math.round(qty * ratio);
    const exwUsd = m.exw * FX.rate;
    const cost = exwUsd + exwUsd * COSTS.dutyPct.v + COSTS.heater.v + perContainer / f;
    cap += cost * q; rev += m.marketMedian * q; n += q;
  }
  const gp = rev - cap - rev * COSTS.paymentFees.v;
  console.log(`     ${String(f).padStart(2)} units → capital ${money(cap).padStart(9)} · revenue ${money(rev).padStart(9)} · GP ${money(gp).padStart(9)} · margin ${pct(gp / rev)}  (${n} costed)`);
}

console.log('\n\nDATA GAPS — these keep the model INCOMPLETE (cost is understated)');
for (const [k, c] of Object.entries(COSTS)) {
  if (c.class === 'UNKNOWN') console.log(`   ${k}: ${c.note}`);
}
const missing = Object.entries(MODELS).filter(([, m]) => m.exw == null).map(([n]) => n);
if (missing.length) console.log(`   dealer EXW missing: ${missing.join(', ')}`);
console.log('\nNothing above is approved for publication.');
