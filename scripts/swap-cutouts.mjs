// Attach exact-model cutout renders from the CAPRA dealer pack.
// Cutout becomes the primary image; any existing image is kept as second.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const SWAPS = [
  ['BUH-ELLA H2', '/images/supplier-capra/ella-h2-indoor-cutout.png'],
  ['aapo', '/images/supplier-capra/aapo-spruce-cutout.png'],
];
const { data: products } = await db.from('products').select('id, model_name, images');
for (const [name, cutout] of SWAPS) {
  const p = products.find((x) => x.model_name === name);
  if (!p) { console.log(`${name}: not found`); continue; }
  const rest = (p.images ?? []).filter((i) => i && i !== cutout);
  const { error } = await db.from('products').update({ images: [cutout, ...rest] }).eq('id', p.id);
  console.log(error ? `${name}: FAIL ${error.message}` : `${name}: cutout attached as primary (${rest.length} previous image(s) kept)`);
}
