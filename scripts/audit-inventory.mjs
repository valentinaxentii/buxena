import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await db.from('inventory').select('product_id, in_stock, incoming, reserved, available, container_number, po_number, eta, created_at, products(model_name)').order('created_at');
if (!data?.length) { console.log('inventory: 0 rows'); }
for (const r of data ?? []) {
  console.log(`${r.products?.model_name} | in_stock=${r.in_stock} incoming=${r.incoming} reserved=${r.reserved} | container=${r.container_number ?? '—'} PO=${r.po_number ?? '—'} ETA=${r.eta ?? '—'} | created=${r.created_at?.slice(0,10)}`);
}
const { data: units } = await db.from('inventory_units').select('id').limit(1);
console.log('inventory_units rows exist:', (units?.length ?? 0) > 0);
const { data: ship } = await db.from('shipments').select('id, status').limit(5);
console.log('shipments:', ship?.length ?? 0);
