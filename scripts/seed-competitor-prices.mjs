#!/usr/bin/env node

/**
 * BUXENA V3 — seed checked competitor price observations.
 * Manual only. Never runs during build/deploy.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const source = path.join(root, 'private-data/competitor-pricing/bsaunas-2026-08-29.json');

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error('Missing SUPABASE_URL (or PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY. Nothing changed.');
  process.exit(1);
}

const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const seed = JSON.parse(await fs.readFile(source, 'utf8'));
let count = 0;

for (const competitor of seed.competitors) {
  const upserted = await supabase
    .from('competitors')
    .upsert({
      name: competitor.name,
      website: competitor.website,
      market: competitor.market,
      default_currency: competitor.default_currency,
      notes: competitor.notes,
    }, { onConflict: 'name' })
    .select('id')
    .single();
  if (upserted.error) throw upserted.error;

  for (const observation of competitor.observations) {
    const result = await supabase.from('competitor_price_observations').upsert({
      competitor_id: upserted.data.id,
      observed_on: seed.checked_on,
      product_name: observation.product_name,
      category: observation.category || null,
      currency: observation.currency,
      price: observation.price,
      compare_at_price: observation.compare_at_price ?? null,
      source_url: observation.source_url,
      availability: observation.availability || null,
      notes: observation.notes || null,
    }, { onConflict: 'competitor_id,observed_on,product_name,source_url' });
    if (result.error) throw result.error;
    count += 1;
  }
}

console.log(`Done. Seeded ${count} competitor price observations checked ${seed.checked_on}.`);
