// Enrich the three Capra DRAFT worksheets with findings from the
// BUXENA-branded ELLA/ILLI/ALLA 2026 catalog (Downloads). Notes only +
// supplier_model precision — no prices invented, statuses stay Draft.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: products } = await db.from('products').select('id, model_name');
const byName = new Map(products.map((p) => [p.model_name, p]));

const CAT = 'ELLA_ILLI_ALLA_2026_Buxena.pdf (BUXENA-branded catalog)';
const UPDATES = [
  ['BUH-ELLA H2', {
    supplier_model: 'Capra ELLA H2 130 (indoor EXW €1,610 / outdoor €1,850 per master workbook; H2 150 width variant also exists — EXW unknown)',
    notes: `Catalog ${CAT}: ELLA H2 130 = 1300×1350×2260mm, 1–2p, ELECTRIC ONLY 3.5–4.5 kW (wood-burning NOT compatible), flat-pack 270kg. WEBSITE SPEC MISMATCH — REVIEW: site page lists W190×L113×H210cm which matches NO catalog variant; correct the public page against this catalog before advertising. PRICE SOURCE CONFLICT — REVIEW REQUIRED: internal admin cost $3,400/sell $5,100 vs workbook EXW €1,610 → landed $3,133, retail hypothesis $5,900 (47%). Assumptions: FX 1.15, duty 15%, freight $3,600/40HC @24, UL heater $750.`,
  }],
  ['BUH-ELLA H1', {
    supplier_model: 'Capra ELLA H1 (1130×1350×2100mm, 1–2p, electric only 3.5–4.5 kW, 240kg — specs verified in BUXENA catalog; EXW MISSING from both catalog and workbook)',
    notes: `Supplier VERIFIED Capra. Specs verified in ${CAT}. EXW NOT in any document on hand — ask Capra for H1 pricing. Internal admin cost $3,200/sell $4,800 unverified. MISSING: EXW.`,
  }],
  ['BUH-ALLA H1', {
    supplier_model: 'Capra ALLA H1 (1130×2710×2100mm, 3–4p, electric only 6.5–8 kW — specs verified in BUXENA catalog; EXW MISSING)',
    notes: `Supplier VERIFIED Capra. Specs verified in ${CAT}. EXW NOT in any document on hand — ask Capra for H1 pricing (workbook only has ALLA H2: €2,550 outdoor / €1,950 indoor). Internal admin cost $4,400/sell $6,600 unverified. MISSING: EXW.`,
  }],
];
for (const [name, patch] of UPDATES) {
  const p = byName.get(name);
  if (!p) continue;
  const { error } = await db.from('product_pricing').update(patch).eq('product_id', p.id);
  console.log(error ? `${name}: FAIL ${error.message}` : `${name}: worksheet enriched`);
}
