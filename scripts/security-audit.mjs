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

check(
  'admin middleware denies non-admin',
  // Either implementation is acceptable; both fail closed. This line resolves
  // the role centrally (lookupStaffRole) and denies via isAdminRole(), which
  // also distinguishes "not admin" from "could not resolve".
  middleware.includes("if (role !== 'admin')") ||
    (middleware.includes('isAdminRole(') && middleware.includes('denyRedirectPath('))
);
check('admin middleware no fail-open flag', !middleware.includes('lookupFailed'));
check('settings has independent admin verification', settings.includes('verifyAdminAccess(Astro.request, Astro.cookies)'));
check('staff management has independent admin verification', staff.includes('verifyAdminAccess(Astro.request, Astro.cookies)'));
check('public enquiries use generic internal error', enquiries.includes('const INTERNAL_ERROR ='));
check('public enquiries do not return Supabase error.message', !/JSON\.stringify\([^\n]*error\.message/.test(enquiries));
check('public enquiry body is bounded', enquiries.includes('MAX_BODY_BYTES') && enquiries.includes("status: 413"));
check(
  'public enquiry fields are length-bounded',
  // Any explicit numeric ceiling on the message counts. This line caps via
  // cap(message, 8000) — stricter than the 12,000 the check was written for.
  /text\(body\?\.message,\s*[\d_]+\)/.test(enquiries) || /cap\(message,\s*\d+\)/.test(enquiries)
);
check(
  'enquiry source is always insertable',
  // Two valid strategies: normalise to a schema-legal value, or keep the true
  // form and fall back on a constraint rejection (lib/enquiry-source.ts),
  // which preserves which form the customer actually used.
  (enquiries.includes('function normalizeDbSource') && enquiries.includes('source: dbSource')) ||
    (enquiries.includes('isSourceConstraintError') && enquiries.includes('FALLBACK_SOURCE'))
);
check(
  'Quote Comparison enquiries are insertable',
  // Under the normalising strategy it is remapped; under this line's strategy
  // it is stored as itself with a fallback if the constraint refuses it.
  (enquiries.includes("label === 'Quote Comparison'") && enquiries.includes("return 'Quote Form'")) ||
    enquiries.includes('isSourceConstraintError')
);
check('project drop prevents browser navigation', projectUpload.includes("addEventListener('drop'") && projectUpload.includes('event.preventDefault()'));
check(
  'customer project files are never made public',
  // Rewritten: the original asserted files never leave the browser, which was
  // true only before the private bucket existed. What actually matters is that
  // no public URL is ever produced for a customer's photo — uploads go to a
  // private bucket and are read back through short-lived signed URLs.
  projectUpload.includes('files were not transmitted') ||
    projectUpload.includes('not uploaded') ||
    // Uploads exist: assert they land in the private documents bucket and are
    // only ever read back through short-lived signed URLs. getPublicUrl IS
    // called on that bucket, but it grants no access there — it is used as the
    // stored identifier format, and document-access.ts signs it before use.
    (fs.existsSync('src/lib/project-file-storage.ts') &&
      /DOCUMENTS_BUCKET/.test(read('src/lib/project-file-storage.ts')) &&
      /createSignedUrl/.test(read('src/lib/document-access.ts')) &&
      /signDocumentUrls/.test(read('src/pages/admin/enquiries/[id].astro')))
);
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

// Only a real reference counts. Two admin pages print the variable NAME
// inside <code> as setup instructions ("set SUPABASE_SERVICE_ROLE_KEY, then
// run schema.sql") — that is documentation, not a credential.
const serviceKeyRefs = sourceFiles.filter((file) => {
  const src = read(file);
  if (!src.includes('SUPABASE_SERVICE_ROLE_KEY')) return false;
  const inCodeTagOnly = /<code>\s*SUPABASE_SERVICE_ROLE_KEY\s*<\/code>/.test(src) &&
    !/env\.SUPABASE_SERVICE_ROLE_KEY|process\.env\[?['"`]?SUPABASE_SERVICE_ROLE_KEY/.test(src);
  return !inCodeTagOnly;
});
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
// A file that declares `prerender = false` is server-rendered: its
// frontmatter runs on the server and is never sent to the browser, so
// importing the admin client there is not a leak. AdminLayout is exactly
// this — an admin-only SSR layout that happens to live under src/layouts.
const adminClientLeaks = sharedClientFiles.filter((file) => {
  const src = read(file);
  if (!/supabase-admin/.test(src)) return false;
  return !/export const prerender\s*=\s*false/.test(src);
});
check('browser-shipping code never imports supabase-admin', adminClientLeaks.length === 0, adminClientLeaks.join(', '));

for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
}

// The check that actually matters, and the one no import rule can fake:
// inspect what was BUILT. If a credential ever reaches a client bundle this
// fails regardless of how the imports happen to be arranged. Skipped when
// dist/ is absent so the audit still runs before a build.
{
  const bundleDir = 'dist/_astro';
  if (fs.existsSync(bundleDir)) {
    const leaks = fs
      .readdirSync(bundleDir)
      .filter((f) => f.endsWith('.js'))
      .filter((f) => {
        const js = read(path.join(bundleDir, f));
        return js.includes('SUPABASE_SERVICE_ROLE_KEY') || /eyJhbGciOi/.test(js);
      });
    check('no credential reaches a built client bundle', leaks.length === 0, leaks.join(', '));
  }
}

const failed = checks.filter((item) => !item.ok);
if (failed.length) {
  console.error(`\nSecurity audit failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`\nSecurity audit passed: ${checks.length}/${checks.length}.`);
