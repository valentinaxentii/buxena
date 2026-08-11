// Create BUH-UKU 160 / 230 admin products (supplier CAPRA, drive images)
// + DRAFT pricing worksheets from the master workbook. Nothing approved.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: sup } = await db.from('suppliers').select('id').eq('name', 'CAPRA').single();
const SRC = 'Buxena_Supplier_Landed_Cost_Master.xlsx (28 Jul 2026) + Capra US product sheets';
const FX = 1.15, DUTY = 15, OCEAN = 150.0, PORT = 104.17, HEATER = 750;

const MODELS = [
  { name: 'BUH-UKU 160', category: 'cube', capacity: '3–4 people', exw: 1930, alt: 2180,
    images: ['/images/supplier-capra/uku-160-glass-front.jpg', '/images/supplier-capra/uku-160-halfmoon.jpg'],
    note: 'EXW €1,930 base (thermo alder bench upgrade €2,180) per master workbook row 27. US product sheet on drive (28.03.24). Options: full glass front / half-moon back / wood door / backrest.' },
  { name: 'BUH-UKU 230', category: 'cube', capacity: '4–6 people', exw: 2240, alt: 2570,
    images: ['/images/supplier-capra/uku-230-glass-front.jpg', '/images/supplier-capra/uku-230-halfmoon.jpg'],
    note: 'EXW €2,240 base (alt €2,570) per workbook row 28; HALF-MOON variant is a separate workbook SKU at €2,590 (row 29) — decide whether half-moon is an option surcharge or its own price before approval. US product sheet (Mar 19, 2025) on drive.' },
];

const { data: existing } = await db.from('products').select('id, model_name');
for (const m of MODELS) {
  let row = existing.find((p) => p.model_name === m.name);
  if (!row) {
    const { data, error } = await db.from('products').insert({
      model_name: m.name, supplier_id: sup.id, category: m.category,
      capacity: m.capacity, images: m.images, is_active: true,
    }).select('id').single();
    if (error) { console.log(`${m.name}: product FAIL ${error.message}`); continue; }
    row = data; console.log(`${m.name}: product created (CAPRA, ${m.images.length} images)`);
  } else console.log(`${m.name}: product already exists — leaving data untouched`);

  const { error: pe } = await db.from('product_pricing').upsert({
    product_id: row.id, supplier_model: m.name.replace('BUH-', 'Capra ') + ' (Round Cube series)',
    exw_eur: m.exw, fx_rate: FX, duty_pct: DUTY, ocean_freight: OCEAN, port_handling: PORT,
    inland_trucking: 0, heater_cost: HEATER, status: 'Draft', source_document: SRC,
    notes: `${m.note} Assumptions: FX ${FX}, duty ${DUTY}% (broker to confirm), freight $3,600/40HC @24 kits, UL heater $750.`,
  }, { onConflict: 'product_id' });
  console.log(pe ? `${m.name}: pricing FAIL ${pe.message}` : `${m.name}: DRAFT worksheet loaded (EXW €${m.exw})`);
}
