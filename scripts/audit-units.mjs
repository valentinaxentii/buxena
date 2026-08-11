import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: units } = await db.from('inventory_units').select('serial_number, status, product_id, created_at, products(model_name)').limit(20);
for (const u of units ?? []) console.log(`unit ${u.serial_number ?? '(no serial)'} | ${u.products?.model_name ?? u.product_id} | status=${u.status} | created=${u.created_at?.slice(0,10)}`);
const { data: ship } = await db.from('shipments').select('shipment_number, status, supplier_id, eta, created_at, suppliers(name)');
for (const s of ship ?? []) console.log(`shipment ${s.shipment_number ?? s.id} | ${s.suppliers?.name ?? 'no supplier'} | ${s.status} | ETA=${s.eta ?? '—'} | created=${s.created_at?.slice(0,10)}`);
