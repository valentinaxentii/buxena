// Adds BALTRESTO and WOOD ARCHITECTS with ONLY founder-provided facts.
// Never touches existing suppliers (CAPRA untouched). Skips if already present.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: existing } = await db.from('suppliers').select('id, name');
console.log('existing suppliers:', existing.map((s) => s.name).join(', ') || '(none)');

const wanted = [
  {
    name: 'BALTRESTO',
    contact_name: 'Anton Kostusjov',
    email: 'sales.manager@baltresto.com',
    country: 'Estonia',
    // Role has no dedicated column — recorded verbatim in notes, not invented.
    notes: 'Contact role: Sales Director (provided by founder 2026-08-10). Phone, address, website, payment terms: Not Provided.',
    currency: null, // not verified — do not assume USD or EUR
  },
  {
    name: 'WOOD ARCHITECTS',
    contact_name: 'Pijus Kazlauskas',
    email: 'pijus@woodarchitects.eu',
    country: 'Lithuania',
    notes: 'Contact role: Not Provided. Phone, address, website, payment terms: Not Provided. (Founder-provided contact 2026-08-10.)',
    currency: null,
  },
];

for (const s of wanted) {
  const dupe = existing.find((e) => e.name.toLowerCase() === s.name.toLowerCase());
  if (dupe) { console.log(`${s.name}: already exists — skipped, unchanged`); continue; }
  const { error } = await db.from('suppliers').insert(s);
  console.log(error ? `${s.name}: FAIL — ${error.message}` : `${s.name}: added`);
}

const { data: after } = await db.from('suppliers').select('name, contact_name, email, country').order('name');
console.log('\nSuppliers now:');
for (const s of after) console.log(` - ${s.name} | ${s.contact_name ?? '—'} | ${s.email ?? '—'} | ${s.country ?? '—'}`);
