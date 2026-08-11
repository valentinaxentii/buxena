// One-time functional test of the new pricing tables, then full cleanup.
// Uses a real product id (FK requirement) but only writes to the NEW tables.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: prod } = await db.from('products').select('id, model_name').limit(1).single();
console.log('test product:', prod.model_name);

// 1. create worksheet
let r = await db.from('product_pricing').insert({
  product_id: prod.id, exw_eur: 4000, fx_rate: 1.1, duty_pct: 5,
  ocean_freight: 500, status: 'Draft',
}).select('exw_usd, duty_amount, sauna_landed_cost').single();
if (r.error) { console.log('INSERT FAIL:', r.error.message); process.exit(1); }
console.log('auto-calc on insert:', JSON.stringify(r.data));
// expect exw_usd 4400, duty 220, landed 5120

// 2. update → history trigger should snapshot the old version
r = await db.from('product_pricing').update({ approved_from_price: 8000, target_margin_pct: 50, status: 'Approved' })
  .eq('product_id', prod.id).select('status, approved_from_price').single();
if (r.error) { console.log('UPDATE FAIL:', r.error.message); process.exit(1); }
console.log('update ok:', JSON.stringify(r.data));

const h = await db.from('product_pricing_history').select('snapshot').eq('product_id', prod.id);
console.log('history rows after update:', h.data?.length, '— old status in snapshot:', h.data?.[0]?.snapshot?.status);

// 3. cleanup — remove test rows completely
await db.from('product_pricing').delete().eq('product_id', prod.id);
await db.from('product_pricing_history').delete().eq('product_id', prod.id);
const c1 = await db.from('product_pricing').select('*', { count: 'exact', head: true });
const c2 = await db.from('product_pricing_history').select('*', { count: 'exact', head: true });
console.log('after cleanup — worksheets:', c1.count, 'history:', c2.count);
