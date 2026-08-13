import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const CONTENT_DIR = path.join(process.cwd(), 'src', 'content', 'saunas');

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()])
);

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
}

const scalar = (frontmatter, key) => {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return null;
  const raw = match[1].trim();
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true';
  return raw.replace(/^['"]|['"]$/g, '');
};

const contentProducts = readdirSync(CONTENT_DIR)
  .filter((name) => name.endsWith('.md'))
  .map((name) => {
    const raw = readFileSync(path.join(CONTENT_DIR, name), 'utf8');
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return null;
    const fm = match[1];
    const title = scalar(fm, 'title');
    if (!title) return null;
    const category = scalar(fm, 'category');
    const draft = scalar(fm, 'draft') === true;
    const placeholder = scalar(fm, 'placeholder') === true;
    return {
      slug: name.replace(/\.md$/, ''),
      model_name: String(title),
      category: category ? String(category) : null,
      is_active: !draft && !placeholder,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.model_name.localeCompare(b.model_name));

const duplicates = contentProducts.filter((item, index, all) =>
  all.findIndex((other) => other.model_name.toLowerCase() === item.model_name.toLowerCase()) !== index
);
if (duplicates.length) {
  console.error('Duplicate content model titles; refusing to continue:', duplicates.map((x) => x.model_name));
  process.exit(1);
}

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: rows, error } = await db.from('products').select('id, model_name, category, is_active').order('model_name');
if (error) throw error;

const dbByName = new Map((rows ?? []).map((row) => [String(row.model_name).trim().toLowerCase(), row]));
const contentNames = new Set(contentProducts.map((row) => row.model_name.trim().toLowerCase()));
const missing = contentProducts.filter((row) => !dbByName.has(row.model_name.trim().toLowerCase()));
const extra = (rows ?? []).filter((row) => !contentNames.has(String(row.model_name).trim().toLowerCase()));
const mismatched = contentProducts.flatMap((row) => {
  const existing = dbByName.get(row.model_name.trim().toLowerCase());
  if (!existing) return [];
  const differences = [];
  if ((existing.category ?? null) !== row.category) differences.push(`category DB=${existing.category ?? 'null'} content=${row.category ?? 'null'}`);
  if (Boolean(existing.is_active) !== row.is_active) differences.push(`is_active DB=${Boolean(existing.is_active)} content=${row.is_active}`);
  return differences.length ? [{ model_name: row.model_name, differences }] : [];
});

console.log(`Content models: ${contentProducts.length}`);
console.log(`DB products: ${rows?.length ?? 0}`);
console.log(`Missing from DB: ${missing.length}`);
missing.forEach((row) => console.log(`  + ${row.model_name} [${row.category ?? 'uncategorized'}]`));
console.log(`Extra DB rows: ${extra.length}`);
extra.forEach((row) => console.log(`  ? ${row.model_name}`));
console.log(`Metadata mismatches: ${mismatched.length}`);
mismatched.forEach((row) => console.log(`  ! ${row.model_name}: ${row.differences.join('; ')}`));

if (!APPLY) {
  console.log('\nDRY RUN ONLY. Nothing was written. Re-run with --apply only after reviewing the report.');
  process.exit(0);
}

if (!missing.length) {
  console.log('\nNothing to insert. Existing DB rows were intentionally left untouched.');
  process.exit(0);
}

// Apply mode is intentionally conservative: insert missing identities only.
// It never changes prices, supplier links, costs, inventory, images, or existing rows.
for (const row of missing) {
  const { error: insertError } = await db.from('products').insert({
    model_name: row.model_name,
    category: row.category,
    is_active: row.is_active,
  });
  if (insertError) throw new Error(`Could not insert ${row.model_name}: ${insertError.message}`);
  console.log(`INSERTED ${row.model_name}`);
}

console.log(`\nInserted ${missing.length} missing product identities. Existing rows were not modified.`);
