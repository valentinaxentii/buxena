/**
 * BUXENA V2 — inquiry-flow browser QA (desktop 1440 + mobile 390).
 *
 *   npm run qa:flow        # owns its own safe-mode dev server
 *
 * Safe by construction: every form submission is intercepted and answered
 * locally, except the single "real safe-mode" pass, which talks only to the
 * dedicated BUXENA_SAFE_MODE test server (that server never sends or stores).
 *
 * The product page's primary CTA is an in-page anchor to #enquire, so the
 * journey asserted here is: CTA -> on-page enquiry form -> the standalone
 * /quote/?model= form that the same page links to for that exact model.
 */
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const qaServer = await startQaServer();
const BASE = qaServer.base;
console.log(`safe-mode test server: ${BASE}\n`);
const browser = await chromium.launch();

const fail = [];
try {
  // ---------------------------------------------------------------- desktop
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    record('desktop: homepage renders the inquiry hero copy',
      (await page.locator('h1').first().innerText()).toUpperCase().includes('WELLNESS'));

    await Promise.all([page.waitForURL(/\/saunas\/$/), page.click('a[href="/saunas/"]')]);
    const cards = await page.locator('a[href^="/saunas/"][href$="/"]').count();
    const broken = await page.evaluate(() => [...document.querySelectorAll('img')]
      .filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')));
    record('desktop: catalogue renders model cards', cards > 10, `${cards} sauna links`);
    record('desktop: catalogue images all decode', broken.length === 0, broken.slice(0, 3).join(', '));

    const slug = await page.evaluate(() => [...document.querySelectorAll('a[href^="/saunas/"][href$="/"]')]
      .map((a) => a.getAttribute('href'))
      .find((h) => /^\/saunas\/[a-z0-9-]+\/$/.test(h) && !/-saunas\/$/.test(h)));
    await page.goto(`${BASE}${slug}`, { waitUntil: 'networkidle' });
    const heroOk = await page.evaluate(() => {
      const img = document.querySelector('.prod-hero__media img, figure img');
      return Boolean(img && img.getAttribute('src') && !/drive\.google/.test(img.getAttribute('src')));
    });
    record('desktop: model page hero image is local and present', heroOk, slug);

    const selected = await page.locator('form[name="quote"] select[name="model"]').inputValue();
    record('desktop: model preselected on the product enquiry form', selected !== '', selected);

    // The product CTA is an in-page anchor to the enquiry section (#enquire —
    // see the PREORDER note in [slug].astro), not a navigation to /quote/. The
    // journey to verify is therefore: CTA -> the form on this page -> the
    // standalone quote form this same page links to for this exact model.
    await page.click('.prod-hero__primary-cta');
    // Anchor navigation is smooth site-wide, so wait for the section to arrive
    // rather than sampling one fixed delay.
    let arrived = true;
    try {
      await page.waitForFunction(() => {
        const s = document.querySelector('#enquire');
        if (!s) return false;
        const b = s.getBoundingClientRect();
        return b.top < window.innerHeight && b.bottom > 0;
      }, null, { timeout: 6000 });
    } catch { arrived = false; }
    const enquiry = await page.evaluate(() => {
      const section = document.querySelector('#enquire');
      const box = section?.getBoundingClientRect();
      return {
        hash: location.hash,
        hasSection: Boolean(section),
        hasForm: Boolean(section?.querySelector('form[name="quote"]')),
        inView: Boolean(box && box.top < window.innerHeight && box.bottom > 0),
      };
    });
    record('desktop: product CTA lands on the on-page enquiry form',
      arrived && enquiry.hash === '#enquire' && enquiry.hasSection && enquiry.hasForm && enquiry.inView, JSON.stringify(enquiry));

    const quoteHref = await page.evaluate(() => document.querySelector('a[href^="/quote/?model="]')?.getAttribute('href') ?? null);
    record('desktop: the page links to the standalone quote form for this exact model',
      quoteHref === `/quote/?model=${encodeURIComponent(selected)}`, String(quoteHref));

    if (quoteHref) {
      await page.goto(`${BASE}${quoteHref}`, { waitUntil: 'networkidle' });
      const carried = await page.locator('form[name="quote"] select[name="model"]').inputValue();
      record('desktop: the standalone quote form carries the model through', carried === selected, carried);
    }
    record('desktop: no page errors on the journey', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ----------------------------------------------------------------- mobile
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/quote/`, { waitUntil: 'networkidle' });
    const order = await page.evaluate(() => {
      const form = document.querySelector('form[name="quote"]').getBoundingClientRect();
      const side = document.querySelector('.quote__side').getBoundingClientRect();
      return { formTop: Math.round(form.top + window.scrollY), sideTop: Math.round(side.top + window.scrollY) };
    });
    record('mobile 390: the form precedes the supporting sidebar', order.formTop < order.sideTop, JSON.stringify(order));

    const overflow = [];
    for (const route of ['/', '/saunas/', '/quote/', '/how-buying-works/']) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 1) overflow.push(`${route}:+${over}px`);
    }
    record('mobile 390: no sideways scrolling on the key routes', overflow.length === 0, overflow.join(', '));

    await page.goto(`${BASE}/quote/?model=BUH-ELLA%20H2`, { waitUntil: 'networkidle' });
    const preselected = await page.locator('form[name="quote"] select[name="model"]').inputValue();
    record('mobile 390: ?model= preselects the model', preselected === 'BUH-ELLA H2', preselected);

    const grid = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('form[name="quote"] .qform__grid'));
      return { columns: style.gridTemplateColumns.split(' ').length };
    });
    record('mobile 390: form grid collapses to one column', grid.columns === 1, JSON.stringify(grid));
    await ctx.close();
  }


  // -------------------------------------- step 1: attribution + duplicates
  let step1Payload = null;
  let step1Requests = 0;
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.route('**/api/enquiries', async (route) => {
      step1Requests += 1;
      step1Payload = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, devMode: true, enquiryId: 'QA-STEP1' }) });
    });
    await page.goto(`${BASE}/quote/?model=BUH-ELLA%20H2&utm_source=qa&utm_medium=test&utm_campaign=demand&gclid=should-be-dropped#contact`, { waitUntil: 'networkidle' });
    await page.fill('#q-name', 'QA Browser');
    await page.fill('#q-email', 'qa@test.local');
    await page.fill('#q-zip', '06830');
    await page.selectOption('#q-budget', '10-20k');
    await page.selectOption('#q-timeline', '1-3-months');

    // Two rapid clicks: the guard must let exactly one request through.
    await page.locator('[data-quote-step="capture"] button[type="submit"]').click();
    await page.locator('[data-quote-step="capture"] button[type="submit"]').click({ force: true }).catch(() => {});
    await sleep(700);

    record('step 1: one inquiry per click burst', step1Requests === 1, `${step1Requests} request(s)`);
    record('step 1: budget and timing reach the request',
      /Total project budget: \$10,000/.test(step1Payload?.message ?? '') && /Timeline: 1/.test(step1Payload?.message ?? ''),
      JSON.stringify(step1Payload?.message ?? '').slice(0, 140));
    const attribution = step1Payload?.attribution ?? {};
    record('step 1: attribution keeps UTM fields and the landing path',
      attribution.utmSource === 'qa' && attribution.utmMedium === 'test' && attribution.utmCampaign === 'demand' && attribution.landingPath === '/quote/',
      JSON.stringify(attribution));
    record('step 1: click id and fragment are not collected',
      !JSON.stringify(step1Payload ?? {}).includes('gclid') && !JSON.stringify(attribution).includes('#'),
      JSON.stringify(attribution));
    const step2 = await page.evaluate(() => {
      const d = document.querySelector('[data-quote-step="detail"]');
      const b = document.querySelector('[data-quote-step="capture"] button');
      return { hidden: d.hidden, type: b.type, disabled: b.disabled, focused: document.activeElement?.id };
    });
    record('step 1: optional step appears and the first button stops being a submit control',
      step2.hidden === false && step2.type === 'button' && step2.disabled === true, JSON.stringify(step2));

    // ------------------------------------- step 2: Enter submits exactly once
    let detailsPayload = null;
    let detailsRequests = 0;
    await page.unroute('**/api/enquiries');
    await page.route('**/api/enquiries', async (route) => {
      detailsRequests += 1;
      detailsPayload = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, devMode: true, enquiryId: 'QA-STEP1' }) });
    });
    await page.selectOption('#q-placement', 'outdoor');
    await page.selectOption('#q-timing-flexibility', 'flexible');
    await page.focus('#q-placement');
    await page.keyboard.press('Enter');
    await sleep(800);
    const enterSubmitted = detailsRequests === 1;
    if (!enterSubmitted) {
      await page.click('[data-quote-details-send]');
      await sleep(800);
    }
    record(`step 2: one details submission${enterSubmitted ? ' from Enter alone' : ' (Enter does not submit a <select> in Chromium, so the button path was used)'}`,
      detailsRequests === 1, `${detailsRequests} request(s)`);
    record('step 2: details merge into step 1 and carry placement + timing',
      detailsPayload?.appendToEnquiryId === 'QA-STEP1' && detailsPayload?.source === 'Quote Form — details'
      && /Placement: Outdoor/.test(detailsPayload?.message ?? '') && /Timing flexibility: I can wait/.test(detailsPayload?.message ?? ''),
      JSON.stringify({ id: detailsPayload?.appendToEnquiryId, source: detailsPayload?.source }));
    await page.click('[data-quote-details-send]', { force: true }).catch(() => {});
    await sleep(500);
    record('step 2: a late click cannot append the same answers twice', detailsRequests === 1, `${detailsRequests} request(s)`);
    const afterLabel = await page.locator('[data-quote-details-send]').innerText();
    record('step 2: the button reports that the details were added', /added/i.test(afterLabel), afterLabel.trim());
    await ctx.close();
  }


  // --------------------------------------------- failure preserves answers
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.route('**/api/enquiries', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"QA forced failure"}' }));
    await page.goto(`${BASE}/quote/`, { waitUntil: 'networkidle' });
    await page.fill('#q-name', 'QA Failure');
    await page.fill('#q-email', 'fail@test.local');
    await page.fill('#q-zip', '06830');
    await page.click('[data-quote-step="capture"] button[type="submit"]');
    await page.waitForSelector('.form-status--error', { timeout: 10000 });
    const kept = await page.evaluate(() => ({
      name: document.querySelector('#q-name').value,
      zip: document.querySelector('#q-zip').value,
      step1Visible: !document.querySelector('[data-quote-step="capture"]').hidden,
      buttonEnabled: !document.querySelector('[data-quote-step="capture"] button').disabled,
    }));
    record('failure: the error is shown and every answer is kept',
      kept.name === 'QA Failure' && kept.zip === '06830' && kept.step1Visible && kept.buttonEnabled, JSON.stringify(kept));
    await ctx.close();
  }

  // ---------------------------- one real safe-mode pass through the API route
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/quote/?model=BUH-ELLA%20H2&utm_campaign=safe-mode-check`, { waitUntil: 'networkidle' });
    await page.fill('#q-name', 'QA Safe Mode');
    await page.fill('#q-email', 'safe-mode@test.local');
    await page.fill('#q-zip', '06830');
    await page.click('[data-quote-step="capture"] button[type="submit"]');
    await page.waitForSelector('.form-status--dev', { timeout: 15000 });
    const devText = await page.locator('.form-status--dev').innerText();
    record('safe mode: the real API answers in test mode (nothing sent or stored)',
      /Local test mode/.test(devText), devText.replace(/\s+/g, ' ').slice(0, 90));
    await page.click('[data-quote-skip]');
    await sleep(600);
    record('safe mode: skip neither navigates away nor opens a live lead', page.url().includes('/quote/'), page.url());
    await ctx.close();
  }
} catch (error) {
  fail.push(String(error));
  record('browser QA run completed', false, String(error).slice(0, 300));
}

const logs = qaServer.logs();
await browser.close();
await qaServer.stop();

const acks = (logs.match(/customer ack would send/g) ?? []).length;
record('safe mode: the test server logged a preview decision, not a send', acks >= 1, `${acks} preview(s)`);

console.log('\n' + '='.repeat(52));
const failures = results.filter((r) => !r.ok);
console.log(`BROWSER QA: ${results.length - failures.length}/${results.length} checks passed`);
for (const f of failures) console.log(`  FAIL ${f.name} — ${f.detail}`);
if (fail.length) console.log(`run error: ${fail[0]}`);
process.exitCode = failures.length ? 1 : 0;
