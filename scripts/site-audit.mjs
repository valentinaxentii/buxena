/**
 * Whole-site audit across SEO, performance, mobile and accessibility risks.
 * Read-only — reports, never edits.  node scripts/site-audit.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const pages = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) pages.push(p);
  }
})(DIST);

const rel = (p) => '/' + path.relative(DIST, p).replace(/\\/g, '/').replace(/index\.html$/, '');
const isPublic = (p) => !/\/(admin|login)\b/.test(rel(p));
const pub = pages.filter(isPublic);

const issues = { seo: [], a11y: [], perf: [], mobile: [] };
const titles = new Map();
const descs = new Map();
let withCanonical = 0, withOG = 0, withOGImage = 0, withBreadcrumb = 0, withProduct = 0, withOrg = 0;

for (const p of pub) {
  const html = readFileSync(p, 'utf8');
  const url = rel(p);
  const title = (html.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) ?? [])[1] ?? '';

  if (!title) issues.seo.push(`${url}: no <title>`);
  else {
    if (title.length > 60) issues.seo.push(`${url}: title ${title.length} chars (>60 may truncate)`);
    if (titles.has(title)) issues.seo.push(`${url}: DUPLICATE title with ${titles.get(title)}`);
    else titles.set(title, url);
  }
  if (!desc) issues.seo.push(`${url}: no meta description`);
  else {
    if (desc.length > 165) issues.seo.push(`${url}: description ${desc.length} chars (>165 may truncate)`);
    if (descs.has(desc)) issues.seo.push(`${url}: DUPLICATE description with ${descs.get(desc)}`);
    else descs.set(desc, url);
  }
  if (/<link rel="canonical"/.test(html)) withCanonical++; else issues.seo.push(`${url}: no canonical`);
  if (/property="og:title"/.test(html)) withOG++; else issues.seo.push(`${url}: no Open Graph`);
  if (/property="og:image"/.test(html)) withOGImage++;
  if (/"@type":\s*"BreadcrumbList"/.test(html)) withBreadcrumb++;
  if (/"@type":\s*"Product"/.test(html)) withProduct++;
  if (/"@type":\s*"Organization"/.test(html)) withOrg++;

  // Accessibility / image hygiene
  for (const m of html.matchAll(/<img\b([^>]*)>/g)) {
    const tag = m[1];
    if (!/\balt=/.test(tag)) issues.a11y.push(`${url}: <img> without alt`);
    const aboveFold = /wordmark__logo|hero__img|hero__video/.test(tag);
    if (!/loading=/.test(tag) && !/fetchpriority="high"/.test(tag) && !aboveFold) {
      issues.perf.push(`${url}: <img> without loading attr`);
    }
  }
  // Mobile risk: fixed pixel widths in inline styles
  for (const m of html.matchAll(/style="[^"]*width:\s*(\d{4,})px/g)) {
    issues.mobile.push(`${url}: inline fixed width ${m[1]}px (overflow risk)`);
  }
  if (!/name="viewport"/.test(html)) issues.mobile.push(`${url}: no viewport meta`);
}

// Oversized shipped assets
const heavy = [];
(function walkAssets(d) {
  if (!existsSync(d)) return;
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    const s = statSync(p);
    if (s.isDirectory()) walkAssets(p);
    else if (/\.(png|jpe?g|webp|mp4|js|css)$/i.test(f) && s.size > 400 * 1024) {
      heavy.push(`${(s.size / 1024 / 1024).toFixed(2)}MB  ${path.relative(DIST, p)}`);
    }
  }
})(DIST);

const dedupe = (a) => [...new Set(a)];
const show = (label, arr, cap = 8) => {
  const d = dedupe(arr);
  console.log(`\n${label}: ${d.length}`);
  d.slice(0, cap).forEach((x) => console.log('   ' + x));
  if (d.length > cap) console.log(`   …and ${d.length - cap} more`);
};

console.log(`public pages audited: ${pub.length} (of ${pages.length} built)`);
console.log(`canonical: ${withCanonical}/${pub.length} · OpenGraph: ${withOG}/${pub.length} · og:image: ${withOGImage}/${pub.length}`);
console.log(`schema — Organization: ${withOrg} · Product: ${withProduct} · Breadcrumb: ${withBreadcrumb}`);
show('SEO issues', issues.seo);
show('Accessibility issues', issues.a11y);
show('Performance issues', issues.perf);
show('Mobile risks', issues.mobile);
show('Assets over 400KB', heavy, 10);
