// Read-only check: do the two new pricing tables exist and respond?
// Prints pass/fail + row counts only — never prints any key or URL.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

for (const table of ['product_pricing', 'product_pricing_history', 'products']) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  console.log(error ? `${table}: FAIL — ${error.message}` : `${table}: OK (${count} rows)`);
}
