// Loads DRAFT pricing worksheets + verified supplier links from the master
// workbook (Buxena_Supplier_Landed_Cost_Master.xlsx, compiled 28 Jul 2026).
// - Everything lands as status=Draft. NOTHING is approved or published.
// - Conflicts vs the admin's existing internal cost/selling numbers are
//   flagged in notes, never resolved silently. Neither source overwritten.
// - Missing EXW values stay null — flagged, not guessed.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const SRC = 'Buxena_Supplier_Landed_Cost_Master.xlsx (compiled 28 Jul 2026)';
// Workbook global assumptions — recorded per worksheet, labelled as assumptions.
const FX = 1.15, DUTY = 15;
// Capra kit: 24 units/40HC → ocean $3600/24=150.00; port+inland $2500/24=104.17
const OCEAN = 150.0, PORT_TRUCK = 104.17, UL_HEATER = 750;

const { data: suppliers } = await db.from('suppliers').select('id, name');
const capraId = suppliers.find((s) => s.name === 'CAPRA')?.id;

const { data: products } = await db.from('products').select('id, model_name, cost, selling_price, supplier_id');
const byName = new Map(products.map((p) => [p.model_name, p]));

const PLANS = [
  { name: 'aapo', exw: 4130, supplierModel: 'AAPO (design flat-roof) — SQUARE/EKE series, 3-4p premium cube',
    note: 'VERIFIED REAL CAPRA MODEL (workbook row 33). Alt wood (thermo alder bench) EXW €4,360. Workbook retail hypothesis $11,900 (46% margin at landed $6,466). Admin row has no internal cost — no conflict.' },
  { name: 'BUH-ELLA H2', exw: 1610, supplierModel: 'ELLA H2 INDOOR — ROUND CUBE series, 2p',
    note: 'PRICE SOURCE CONFLICT — REVIEW REQUIRED: internal admin cost $3,400 / selling $5,100 vs workbook EXW €1,610 → landed $3,133 with retail hypothesis $5,900 (47%). Outdoor variant exists at EXW €1,850. Neither source overwritten.' },
  { name: 'BUH-ELLA H1', exw: null, supplierModel: 'ELLA H1 (Capra ELLA family)',
    note: 'Supplier VERIFIED as Capra (ELLA family, workbook + ELLA_ILLI_ALLA_2026_Buxena.pdf). H1-variant EXW NOT in master workbook (only H2 + square ELLA) — check full Capra pricelist. Internal admin cost $3,200 / selling $4,800 unverified against supplier sheet. MISSING: EXW.' },
  { name: 'BUH-ALLA H1', exw: null, supplierModel: 'ALLA H1 (Capra ALLA family)',
    note: 'Supplier VERIFIED as Capra. H1-variant EXW NOT in master workbook (ALLA H2: €2,550 outdoor / €1,950 indoor) — check full Capra pricelist. Internal admin cost $4,400 / selling $6,600 unverified. MISSING: EXW.' },
  { name: 'BUH-EDA Nordic Spruce 2.5m', exw: null, supplierModel: 'EDA D2 barrel (Capra D2 BARRELS series)',
    note: 'Supplier VERIFIED as Capra (EDA = Capra D2 barrel line, workbook rows 52-53). 2.5m-variant EXW NOT in workbook (has EDA D2 160 €1,570 / EDA D2 200 €1,870) — check full Capra pricelist for 2.5m. Internal admin cost $5,200 / selling $7,900 unverified. MISSING: EXW for exact size.' },
  { name: 'BUH-AURA Thermowood 1.3m', exw: null, supplierModel: null,
    note: 'SUPPLIER NOT VERIFIED — AURA appears in no supplier document found so far (not in master workbook). REVIEW REQUIRED before selling. MISSING: supplier, EXW.' },
];

for (const plan of PLANS) {
  const p = byName.get(plan.name);
  if (!p) { console.log(`${plan.name}: not in products table — skipped`); continue; }

  // supplier link — only where verified (everything except AURA)
  if (plan.supplierModel && capraId && p.supplier_id !== capraId && !plan.note.startsWith('SUPPLIER NOT')) {
    const { error } = await db.from('products').update({ supplier_id: capraId }).eq('id', p.id);
    console.log(error ? `${plan.name}: supplier link FAIL ${error.message}` : `${plan.name}: supplier → CAPRA (verified)`);
  }

  const row = {
    product_id: p.id,
    supplier_model: plan.supplierModel,
    source_document: SRC,
    status: 'Draft',
    notes: `${plan.note} Assumptions from workbook: FX ${FX} (verify at order), duty ${DUTY}% (confirm dutiable basis with broker), freight $3,600/40HC @24 kits, port+trucking $2,500/container, UL heater $750 (HUUM Drop 9 est.).`,
    ...(plan.exw != null ? {
      exw_eur: plan.exw, fx_rate: FX, duty_pct: DUTY,
      ocean_freight: OCEAN, port_handling: PORT_TRUCK, inland_trucking: 0,
      heater_cost: UL_HEATER,
    } : {}),
  };
  const { data: saved, error } = await db.from('product_pricing').upsert(row, { onConflict: 'product_id' })
    .select('sauna_landed_cost, complete_landed_cost').single();
  console.log(error
    ? `${plan.name}: worksheet FAIL ${error.message}`
    : `${plan.name}: DRAFT worksheet loaded${saved.sauna_landed_cost ? ` — landed $${saved.sauna_landed_cost}` : ' — EXW missing, flagged'}`);
}
