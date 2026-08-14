/**
 * Deliberate failure testing — what a customer (or an attacker) sees when
 * something goes wrong.
 *
 * Every case here is a request the happy-path suites never send: bad routes,
 * malformed bodies, forged tokens, oversized payloads, wrong methods. The
 * assertions are about SAFETY, not success:
 *
 *   · the status code is the appropriate one (404 not 500, 4xx not 2xx)
 *   · no internal exception text reaches the response body
 *   · no admin content renders for an anonymous caller
 *   · a malformed enquiry is refused rather than half-stored
 *
 * "No internal exceptions leaked" is checked with the same signature list the
 * runtime sweep uses, plus stack-trace shapes (`at async`, file paths).
 *
 *   node scripts/failure-modes.mjs            # against localhost:4321
 */
const BASE = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');

const LEAK_SIGNATURES = [
  'ReferenceError', 'TypeError', 'SyntaxError', 'at async ', 'node_modules',
  'Unhandled Rejection', 'PostgrestError', 'supabase', 'SUPABASE_SERVICE',
  'stack trace', 'ENOENT', 'EACCES', 'astro-error', 'Cannot read properties',
  'is not defined', 'is not a function', 'internal server error occurred',
];

// Case-insensitive for infra words; case-sensitive for error-class names
// (matching "supabase" must not trip on a legitimate public script URL — so
// keep the list tight and check bodies, not headers).
function leaks(body) {
  const lower = body.toLowerCase();
  return LEAK_SIGNATURES.find((s) =>
    s === s.toLowerCase() ? lower.includes(s) : body.includes(s)
  );
}

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, { redirect: 'manual', ...opts });
  const body = await res.text();
  return { status: res.status, body, headers: res.headers };
}

console.log(`Failure-mode testing against ${BASE}\n`);

// --- 1. invalid routes -------------------------------------------------------
{
  const cases = [
    '/definitely-not-real/',
    '/saunas/not-a-model/',
    '/saunas/../../etc/passwd',
    '/saunas/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '/collections/not-a-collection/',
    '/proposal/', // token route with no token
  ];
  for (const c of cases) {
    const { status, body } = await req(c);
    const leak = leaks(body);
    record(
      `bad route ${c}`,
      (status === 404 || status === 400 || status === 301 || status === 308) && !leak,
      `HTTP ${status}${leak ? ` LEAKED "${leak}"` : ''}`
    );
  }
}

// --- 2. malformed / forged proposal tokens ----------------------------------
{
  const cases = [
    '/proposal/abc/',                       // too short
    '/proposal/' + 'a'.repeat(64) + '/',    // wrong shape, right-ish length
    '/proposal/00000000000000000000000000000000/', // all zeroes
    "/proposal/'%20OR%201=1--/",            // injection shape
    '/unit/definitely-not-a-token/',
  ];
  for (const c of cases) {
    const { status, body } = await req(c);
    const leak = leaks(body);
    record(
      `forged token ${c.slice(0, 34)}…`,
      status === 404 && !leak,
      `HTTP ${status}${leak ? ` LEAKED "${leak}"` : ''}`
    );
  }
}

// --- 3. admin without a session ---------------------------------------------
{
  for (const c of ['/admin', '/admin/enquiries', '/admin/quotes', '/admin/settings', '/admin/leads']) {
    const { status, body } = await req(c);
    // 302 to login is the design; anything that renders content is a failure.
    const rendersAdmin = /enquir|quote|dashboard|settings/i.test(body) && status === 200;
    record(`anonymous ${c}`, status === 302 && !rendersAdmin, `HTTP ${status}`);
  }
}

// --- 4. malformed enquiry submissions ---------------------------------------
{
  const post = (bodyObj, extra = {}) =>
    req('/api/enquiries', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...extra },
      body: typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj),
    });

  {
    const { status, body } = await post('this is not json');
    record('enquiry: non-JSON body', status >= 400 && status < 500 && !leaks(body), `HTTP ${status}`);
  }
  {
    const { status, body } = await post({});
    record('enquiry: empty object', status >= 400 && status < 500 && !leaks(body), `HTTP ${status}`);
  }
  {
    const { status, body } = await post({ name: 'X', email: 'not-an-email', message: 'hi' });
    record('enquiry: invalid email', status >= 400 && status < 500 && !leaks(body), `HTTP ${status}`);
  }
  {
    // The honeypot filled in = a bot. Must not create a record; the polite
    // response shape is fine, an error is fine, a 5xx is not.
    const { status, body } = await post({
      name: 'Bot', email: 'bot@example.com', message: 'spam', botField: 'gotcha',
    });
    record('enquiry: honeypot tripped', status < 500 && !leaks(body), `HTTP ${status}`);
  }
  {
    // Oversized payload: the API declares MAX_BODY_BYTES / 413.
    const { status, body } = await post({
      name: 'Big', email: 'big@example.com', message: 'x'.repeat(300_000),
    });
    record('enquiry: oversized body', (status === 413 || (status >= 400 && status < 500)) && !leaks(body), `HTTP ${status}`);
  }
  {
    // XSS shape in every field — must be refused or stored inert, and the
    // ERROR PATH itself must not reflect the payload unescaped.
    const payload = '<script>alert(1)</script>';
    const { status, body } = await post({ name: payload, email: 'a@b.co', message: payload });
    const reflected = body.includes(payload);
    record('enquiry: script payload not reflected', !reflected && !leaks(body), `HTTP ${status}${reflected ? ' REFLECTED' : ''}`);
  }
  {
    const { status, body } = await req('/api/enquiries', { method: 'GET' });
    record('enquiry: GET refused', status === 405 || status === 404 || status === 400, `HTTP ${status}`);
  }
}

// --- 5. proposal-accept API abuse -------------------------------------------
{
  const post = (bodyObj) =>
    req('/api/proposal-accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(bodyObj),
    });
  // This endpoint is a FORM ACTION using POST-redirect-GET: failures answer
  // 303 to /proposal/invalid (which itself renders 404) rather than a JSON
  // 4xx. That is safe by design — no acceptance occurs and nothing leaks — so
  // the assertion is "303 to a safe location", not "4xx". The first version of
  // this test demanded 4xx and flagged correct behaviour as unsafe.
  const safeRedirect = (headers) => {
    const loc = headers.get('location') ?? '';
    return loc.startsWith('/proposal/');
  };
  {
    const { status, body, headers } = await post({ token: 'not-a-real-token', name: 'Nobody' });
    record(
      'accept: forged token',
      (status === 303 && safeRedirect(headers) && !leaks(body)) || (status >= 400 && status < 500),
      `HTTP ${status} → ${headers.get('location') ?? ''}`
    );
  }
  {
    const { status, body, headers } = await post({});
    record(
      'accept: empty body',
      (status === 303 && safeRedirect(headers) && !leaks(body)) || (status >= 400 && status < 500),
      `HTTP ${status} → ${headers.get('location') ?? ''}`
    );
  }
}

// --- 6. header + method edge cases ------------------------------------------
{
  {
    const { status, body } = await req('/api/enquiries', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'name=x',
    });
    record('enquiry: wrong content-type', status >= 400 && status < 500 && !leaks(body), `HTTP ${status}`);
  }
  {
    const { status } = await req('/', { method: 'POST' });
    record('POST to a static page', status !== 500, `HTTP ${status}`);
  }
}

// --- summary -----------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(`\nfailure modes: ${results.length - failed.length}/${results.length} safe`);
if (failed.length) {
  console.log('\nUNSAFE RESPONSES:');
  for (const f of failed) console.log(`  ✗ ${f.name} — ${f.detail}`);
  process.exit(1);
}
