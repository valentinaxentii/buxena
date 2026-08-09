/**
 * Backfill `profiles` rows for staff who have a Supabase auth account but no
 * profile.
 *
 * WHY THIS EXISTS
 * schema.sql creates the `profiles` table but nothing ever writes to it, while
 * AdminLayout reads `profiles.full_name` to label the signed-in user. With the
 * table empty the admin falls back to showing raw email addresses, which is how
 * a founder's personal Gmail ended up in the sidebar of the back office. Adding
 * a staff member through the Supabase dashboard creates the auth user only, so
 * this gap reappears every time someone is added — run this afterwards.
 *
 * WHAT IT DOES
 * Inserts a profile for every auth user that lacks one. Existing rows are left
 * alone, so names and roles you have already set are never overwritten and the
 * script is safe to re-run.
 *
 * New rows get the schema's default role, 'staff' — never 'admin'. Promoting
 * someone is a deliberate act, not something a backfill script should decide.
 * Set real names and roles afterwards in the Supabase table editor.
 *
 * NOTE ON ROLES: nothing enforces `role` today. Every authenticated user
 * reaches every admin route — which is correct while the only accounts are
 * founders. The column is populated so the distinction is ready the day
 * someone who is not a founder needs access; that will also need a check in
 * src/middleware.ts.
 *
 * USAGE
 *   node supabase/seed-profiles.mjs
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env at the repo root.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
if (authErr) {
  console.error('Could not list auth users:', authErr.message);
  process.exit(1);
}

const { data: existing, error: profErr } = await supabase.from('profiles').select('id');
if (profErr) {
  console.error('Could not read profiles:', profErr.message);
  process.exit(1);
}

const have = new Set(existing.map((p) => p.id));
const missing = authData.users.filter((u) => !have.has(u.id));

if (!missing.length) {
  console.log(`All ${authData.users.length} auth users already have a profile. Nothing to do.`);
  process.exit(0);
}

// Fall back to the email's local part so the sidebar shows something readable
// rather than a full address; a person's real name is set afterwards by hand.
const rows = missing.map((u) => ({
  id: u.id,
  full_name: (u.email ?? '').split('@')[0] || 'Staff',
  role: 'staff',
}));

const { error: insErr } = await supabase.from('profiles').insert(rows);
if (insErr) {
  console.error('Insert failed:', insErr.message);
  process.exit(1);
}

console.log(`Created ${rows.length} profile(s):`);
for (const r of rows) console.log(`  ${r.full_name}  (role: ${r.role})`);
console.log('\nSet real names, and promote anyone who needs admin, in the Supabase table editor.');
