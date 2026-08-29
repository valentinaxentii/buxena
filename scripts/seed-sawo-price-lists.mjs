#!/usr/bin/env node

/**
 * BUXENA V3 — seed the two founder-approved SAWO 2026 price lists into the
 * private supplier-price registry.
 *
 * This script is intentionally NOT part of build/prebuild. It changes the
 * connected database and must only be run deliberately after the V3 registry
 * migration has been applied to the intended Supabase environment.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const seedFiles = [
  path.join(root, 'private-data/supplier-pricing/sawo-accessories-2026-08.prices.json'),
  path.join(root, 'private-data/supplier-pricing/sawo-sauna_rooms-2026-08.prices.json'),
];

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error('Missing SUPABASE_URL (or PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY. Nothing changed.');
  process.exit(1);
}

const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

function batches(rows, size = 150) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function getSawoSupplier() {
  const existing = await supabase.from('suppliers').select('id, name').ilike('name', 'SAWO').limit(1).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase
    .from('suppliers')
    .insert({ name: 'SAWO', currency: 'USD', incoterm: 'FCA' })
    .select('id, name')
    .single();
  if (created.error) throw created.error;
  return created.data;
}

async function upsertList(supplierId, seed) {
  const existing = await supabase
    .from('supplier_price_lists')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('source_sha256', seed.source_sha256)
    .maybeSingle();
  if (existing.error) throw existing.error;

  let listId = existing.data?.id;
  if (!listId) {
    const inserted = await supabase
      .from('supplier_price_lists')
      .insert({
        supplier_id: supplierId,
        catalog_scope: seed.scope,
        list_name: seed.list_name,
        source_filename: seed.source_filename,
        source_sha256: seed.source_sha256,
        price_list_date: seed.price_list_date,
        currency: seed.currency,
        incoterm: seed.incoterm,
        price_column_label: seed.price_column_label || 'OLEG BUJOR FCA SAWO',
        row_count: seed.row_count,
        status: 'Imported',
        is_current: false,
        notes: 'BUXENA V3 normalized seed from founder-supplied SAWO workbook. Original workbook hash retained.',
      })
      .select('id')
      .single();
    if (inserted.error) throw inserted.error;
    listId = inserted.data.id;
  }

  for (const group of batches(seed.items)) {
    const payload = group.map((row) => ({
      ...row,
      price_list_id: listId,
      raw_cells: { normalized_seed: true, source_row: row.source_row },
    }));
    const result = await supabase.from('supplier_price_items').upsert(payload, { onConflict: 'price_list_id,source_row' });
    if (result.error) throw result.error;
  }

  // Only after every row is present do we switch the current pointer.
  const old = await supabase
    .from('supplier_price_lists')
    .update({ is_current: false, status: 'Superseded' })
    .eq('supplier_id', supplierId)
    .eq('catalog_scope', seed.scope)
    .eq('is_current', true)
    .neq('id', listId);
  if (old.error) throw old.error;

  const current = await supabase
    .from('supplier_price_lists')
    .update({ is_current: true, status: 'Approved', row_count: seed.row_count })
    .eq('id', listId);
  if (current.error) throw current.error;

  return listId;
}

const supplier = await getSawoSupplier();
let total = 0;
for (const file of seedFiles) {
  const seed = JSON.parse(await fs.readFile(file, 'utf8'));
  if (seed.supplier !== 'SAWO') throw new Error(`Unexpected supplier in ${file}`);
  if (seed.rows.length !== seed.row_count) throw new Error(`Row-count mismatch in ${file}`);
  seed.items = seed.rows.map(([source_row, source_item, material, unit_cost]) => ({
    source_row,
    section: null,
    item_name: source_item,
    source_item,
    supplier_sku: null,
    ean: null,
    dimensions: null,
    material: material || null,
    pack_length: null,
    pack_width: null,
    pack_height: null,
    pack_unit: seed.scope === 'accessories' ? 'mm' : 'm',
    weight_kg: null,
    package_m3: null,
    master_box_qty: null,
    inner_box_qty: null,
    unit_cost,
  }));
  await upsertList(supplier.id, seed);
  total += seed.row_count;
  console.log(`Seeded ${seed.list_name}: ${seed.row_count} price rows.`);
}
console.log(`Done. ${total} SAWO supplier-price rows are current in the private registry.`);
