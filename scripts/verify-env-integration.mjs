/**
 * Verifies that the V2 code correctly READS and USES the production
 * environment variables — without sending anything or writing anything.
 *
 *   node scripts/verify-env-integration.mjs
 *
 * What it proves:
 *   1. every variable the code reads is present and non-empty
 *   2. the Supabase service-role client can actually authenticate (READ ONLY)
 *   3. the SMTP transport builds and the server ACCEPTS the credentials
 *      (connection + AUTH only — no message is ever handed to it)
 *   4. the values are internally consistent (host matches the mailbox region)
 *
 * SAFETY: no INSERT, no UPDATE, no sendMail. Nothing leaves the machine except
 * a Supabase read and an SMTP handshake. Secrets are never printed.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// Netlify is the source of truth in production; this script reads a local
// .env only to exercise the same code paths. A value missing LOCALLY says
// nothing about Netlify — the report distinguishes the two.
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const REQUIRED = [
  ['SUPABASE_URL', 'enquiry storage + admin'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'server-side DB access'],
  ['SUPABASE_ANON_KEY', 'admin sign-in'],
  ['ZOHO_SMTP_USER', 'sender mailbox'],
  ['ZOHO_SMTP_PASSWORD', 'Zoho app password'],
  ['ZOHO_SMTP_HOST', 'SMTP host'],
];

let fail = 0;
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); fail++; };

console.log('1 · PRESENCE');
for (const [k, why] of REQUIRED) {
  if (env[k] && env[k].length > 3) ok(`${k} present (${why})`);
  else bad(`${k} MISSING or empty (${why})`);
}

console.log('\n2 · CONSISTENCY');
if (/zohocloud\.ca$/.test(env.ZOHO_SMTP_HOST ?? '')) ok('ZOHO_SMTP_HOST is the Canadian DC (smtp.zohocloud.ca)');
else bad(`ZOHO_SMTP_HOST is "${env.ZOHO_SMTP_HOST}" — Canadian mailboxes need smtp.zohocloud.ca or auth fails with 535`);
if (/@/.test(env.ZOHO_SMTP_USER ?? '')) ok(`ZOHO_SMTP_USER looks like a mailbox (${(env.ZOHO_SMTP_USER ?? '').split('@')[1] ?? '?'})`);
else bad('ZOHO_SMTP_USER is not an email address');
if ((env.SUPABASE_URL ?? '').startsWith('https://')) ok('SUPABASE_URL is https');
else bad('SUPABASE_URL is not an https URL');
if ((env.SUPABASE_SERVICE_ROLE_KEY ?? '') !== (env.SUPABASE_ANON_KEY ?? '')) ok('service_role and anon keys are different');
else bad('service_role and anon keys are IDENTICAL — one of them is wrong');

console.log('\n3 · SUPABASE (read-only)');
try {
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { count, error } = await sb.from('enquiries').select('*', { count: 'exact', head: true });
  if (error) bad(`enquiries table unreachable: ${error.message}`);
  else ok(`service-role client authenticated · enquiries table reachable (${count} rows)`);
  const { error: pErr } = await sb.from('products').select('id', { head: true, count: 'exact' });
  if (pErr) bad(`products table unreachable: ${pErr.message}`);
  else ok('products table reachable (admin will load)');
} catch (e) {
  bad(`Supabase client failed: ${String(e).slice(0, 120)}`);
}

console.log('\n4 · SMTP (handshake + auth only — no message sent)');
try {
  const port = Number(env.ZOHO_SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: env.ZOHO_SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: env.ZOHO_SMTP_USER, pass: env.ZOHO_SMTP_PASSWORD },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  await transport.verify();          // connects + authenticates, sends nothing
  ok('SMTP server accepted the credentials — acknowledgment email will send once deployed');
  transport.close();
} catch (e) {
  const msg = String(e?.message ?? e);
  if (!env.ZOHO_SMTP_PASSWORD) {
    console.log('  – SMTP NOT VERIFIABLE LOCALLY: ZOHO_SMTP_PASSWORD is empty in the local .env.');
    console.log('    This does NOT indicate a problem in Netlify. To verify the real');
    console.log('    credentials, run this script in a context that has them, or rely on');
    console.log('    the single controlled preview test.');
  } else bad(`SMTP verify failed: ${msg.slice(0, 160)}`);
  if (/535|auth/i.test(msg)) console.log('     → 535 usually means: wrong host region, or a normal password used instead of a Zoho App Password');
}

console.log('\n5 · SAFETY GUARDS');
if (!env.ENQUIRIES_DEV_LIVE || env.ENQUIRIES_DEV_LIVE !== 'true') ok('ENQUIRIES_DEV_LIVE not enabled — local dev cannot reach live services');
else bad('ENQUIRIES_DEV_LIVE=true — local form submissions WILL hit production');

console.log(`\n${fail === 0 ? '✓ ALL CHECKS PASSED — integration verified, nothing sent' : `✗ ${fail} CHECK(S) FAILED`}`);
process.exitCode = fail ? 1 : 0;
