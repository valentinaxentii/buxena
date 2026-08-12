/**
 * READ-ONLY audit of who can sign in to the back office and what role they
 * hold. Writes nothing, sends nothing, changes nothing.
 *
 * Run this BEFORE tightening any role-gated permission. Locking an action to
 * role='admin' while the founders' own profiles say 'staff' locks the founders
 * out of their own business — this script is how you check first.
 *
 * Pairs with promote-staff-admin.mjs, which is the (deliberate, one-at-a-time)
 * way to fix what this finds.
 *
 *   node scripts/audit-staff-roles.mjs
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env at the repo root.
 * Neither is printed.
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

const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, full_name, role');
if (profErr) {
  console.error('Could not read profiles:', profErr.message);
  process.exit(1);
}

const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

const rows = authData.users.map((u) => {
  const p = byId.get(u.id);
  return {
    email: u.email ?? '(no email)',
    name: p?.full_name ?? '',
    role: p ? p.role : null, // null === no profiles row at all
    lastSignIn: u.last_sign_in_at ? u.last_sign_in_at.slice(0, 10) : 'never',
  };
});
rows.sort((a, b) => a.email.localeCompare(b.email));

console.log(`\nBack-office accounts (${rows.length})\n${'─'.repeat(72)}`);
for (const r of rows) {
  const role = r.role === null ? 'NO PROFILE ROW' : r.role.toUpperCase();
  const flag = r.role === 'admin' ? ' ' : '!';
  console.log(
    `${flag} ${r.email.padEnd(34)} ${role.padEnd(15)} ${(r.name || '—').padEnd(14)} last: ${r.lastSignIn}`
  );
}

const admins = rows.filter((r) => r.role === 'admin');
const staff = rows.filter((r) => r.role === 'staff');
const missing = rows.filter((r) => r.role === null);

console.log('─'.repeat(72));
console.log(`admin: ${admins.length}   staff: ${staff.length}   no profile row: ${missing.length}`);

if (admins.length === 0) {
  console.log(
    '\n⛔ NO ADMIN ACCOUNTS EXIST.\n' +
      '   Admin-only actions (Settings, and permanent deletion) would be closed to\n' +
      '   everyone, including the founders. Promote at least one account BEFORE\n' +
      '   relying on those gates:\n' +
      '     node scripts/promote-staff-admin.mjs <email>\n'
  );
  process.exit(2);
}

if (admins.length === 1) {
  console.log(
    `\n⚠  Only one admin (${admins[0].email}). If that account is lost, nobody can\n` +
      '   reach Settings or delete records. Consider promoting a second founder.\n'
  );
}

if (missing.length) {
  console.log(
    `\n⚠  ${missing.length} account(s) have no profiles row — they are treated as\n` +
      '   least-privilege (not admin). Run: node supabase/seed-profiles.mjs\n'
  );
}

console.log('Read-only audit complete. Nothing was changed.\n');
