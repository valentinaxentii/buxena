import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await db.from('products').select('id, model_name, category, images, cost, selling_price, is_active, suppliers(name)').order('model_name');
for (const p of data) {
  console.log(`${p.model_name} | supplier=${p.suppliers?.name ?? 'NONE'} | images=${(p.images??[]).length} | cost=${p.cost ?? '—'} | selling=${p.selling_price ?? '—'} | active=${p.is_active}`);
}
