import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await db.from('supplier_products').select('supplier_id, product_id, supplier_model_code, suppliers(name), products(model_name)');
if (error) { console.log('supplier_products:', error.message); process.exit(0); }
if (!data.length) { console.log('supplier_products: 0 rows — no recorded links'); }
for (const r of data) console.log(`${r.suppliers?.name} -> ${r.products?.model_name ?? r.product_id} (${r.supplier_model_code ?? 'no code'})`);
const { data: docs } = await db.from('documents').select('title:file_name, category, supplier_id, suppliers(name)').not('supplier_id','is',null).limit(20);
console.log('\nsupplier documents:');
for (const d of docs ?? []) console.log(`${d.suppliers?.name}: ${d.title} [${d.category}]`);
