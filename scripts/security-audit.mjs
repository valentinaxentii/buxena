import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');
const checks = [];
const check = (name, condition, detail = '') => checks.push({ name, ok: Boolean(condition), detail });

const middleware = read('src/middleware.ts');
const settings = read('src/pages/admin/settings/index.astro');
const staff = read('src/pages/admin/settings/staff.astro');
const enquiries = read('src/pages/api/enquiries.ts');
const projectUpload = read('src/components/ProjectUpload.astro');
const forgotPassword = read('src/pages/login/forgot-password.astro');
const hardening = read('supabase/security-hardening.sql');

check('admin middleware denies non-admin', middleware.includes("if (role !== 'admin')"));
check('admin middleware no fail-open flag', !middleware.includes('lookupFailed'));
check('settings has independent admin verification', settings.includes('verifyAdminAccess(Astro.request, Astro.cookies)'));
check('staff management has independent admin verification', staff.includes('verifyAdminAccess(Astro.request, Astro.cookies)'));
check('public enquiries use generic internal error', enquiries.includes('const INTERNAL_ERROR ='));
check('public enquiries do not return Supabase error.message', !/JSON\.stringify\([^\n]*error\.message/.test(enquiries));
check('public enquiry body is bounded', enquiries.includes('MAX_BODY_BYTES') && enquiries.includes("status: 413"));
check('public enquiry fields are length-bounded', enquiries.includes('text(body?.message, 12_000)'));
check('enquiry sources are normalized to live schema', enquiries.includes('function normalizeDbSource') && enquiries.includes('source: dbSource'));
check('quote comparison maps to Quote Form', enquiries.includes("label === 'Quote Comparison'") && enquiries.includes("return 'Quote Form'"));
check('project drop prevents browser navigation', projectUpload.includes("addEventListener('drop'") && projectUpload.includes('event.preventDefault()'));
check('project files remain metadata-only', projectUpload.includes('files were not transmitted') || projectUpload.includes('not uploaded'));
check('password reset requests are locally rate limited', forgotPassword.includes('password-reset:') && forgotPassword.includes('checkRateLimit'));
check('security-definer view hardened', hardening.includes('alter view public.orders_with_margin set (security_invoker = true)'));
check('anon cannot execute document numbering', hardening.includes('issue_document_number(uuid) from public, anon, authenticated'));
check('anon cannot execute inventory issuance', hardening.includes('issue_inventory_unit(uuid, uuid, uuid, numeric, text) from public, anon, authenticated'));
check('anon cannot execute service-case numbering', hardening.includes('issue_service_case_number() from public, anon, authenticated'));

// Service-role containment: the full-access key may only be named in the
// dedicated server client. Components, layouts and shared browser libraries
// must never import the admin client or reference the key directly.
const sourceFiles = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) walk(file);
    else if (/\.(astro|ts|js|mjs)$/.test(name)) sourceFiles.push(file);
  }
})('src');

const serviceKeyRefs = sourceFiles.filter((file) => read(file).includes('SUPABASE_SERVICE_ROLE_KEY'));
check(
  'service-role key is named only by dedicated server client',
  serviceKeyRefs.length === 1 && serviceKeyRefs[0].replace(/\\/g, '/') === 'src/lib/supabase-admin.ts',
  serviceKeyRefs.join(', ')
);

const browserRoots = ['src/components', 'src/layouts'];
const sharedClientFiles = sourceFiles.filter((file) =>
  browserRoots.some((root) => file.replace(/\\/g, '/').startsWith(root + '/')) ||
  file.replace(/\\/g, '/') === 'src/lib/enquiry-client.ts' ||
  file.replace(/\\/g, '/') === 'src/lib/track.ts'
);
const adminClientLeaks = sharedClientFiles.filter((file) => /supabase-admin/.test(read(file)));
check('browser-shipping code never imports supabase-admin', adminClientLeaks.length === 0, adminClientLeaks.join(', '));

for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
}

const failed = checks.filter((item) => !item.ok);
if (failed.length) {
  console.error(`\nSecurity audit failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`\nSecurity audit passed: ${checks.length}/${checks.length}.`);
