// Attaches each DB product's OWN hero image — exact model-name matches only.
// Images are the ones already associated with that exact model in the site
// catalog (public/images/saunas/). No other fields touched. "aapo" gets
// nothing (no image exists for it; flagged REVIEW REQUIRED separately).
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// exact model → image path, verified to exist on disk before writing
//
// 2026-08-16: corrected from stale .png duplicates. alla-h1-hero.png,
// ella-h1-hero.png and ella-h2-hero.png were leftover pre-fix copies —
// alla-h1-hero.png was byte-identical to alla-h2-hero.png, and
// ella-h1-hero.png was byte-identical to ella-h2-hero.png, i.e. this map
// was pointing two different models at the same photo. The .png files have
// since been deleted from public/images/saunas; the .jpg files below are
// the current, per-model-distinct site images (see content frontmatter).
const MAP = {
  'BUH-ALLA H1': '/images/saunas/alla-h1-hero.jpg',
  'BUH-AURA Thermowood 1.3m': '/images/saunas/aura-thermowood-1-3m-hero.jpeg',
  'BUH-EDA Nordic Spruce 2.5m': '/images/saunas/eda-nordic-spruce-2-5m-hero.png',
  'BUH-ELLA H1': '/images/saunas/ella-h1-hero.jpg',
  'BUH-ELLA H2': '/images/saunas/ella-h2-hero.jpg',
};

const { data: products } = await db.from('products').select('id, model_name, images');
for (const p of products) {
  const img = MAP[p.model_name];
  if (!img) { console.log(`${p.model_name}: no exact-match image — left as-is`); continue; }
  if (!existsSync(`public${img}`)) { console.log(`${p.model_name}: file missing on disk — skipped`); continue; }
  if ((p.images ?? []).length > 0) { console.log(`${p.model_name}: already has images — untouched`); continue; }
  const { error } = await db.from('products').update({ images: [img] }).eq('id', p.id);
  console.log(error ? `${p.model_name}: FAIL ${error.message}` : `${p.model_name}: image attached (${img})`);
}
