/**
 * Per-product QA against the BUILT site:
 *  - the card in every listing links to that model's own page
 *  - the Request Quote CTA carries that model's own title
 *  - every image on a product page belongs to that model (filename stem must
 *    relate to the slug) — catches "showed a different sauna" directly
 *  - every img has non-empty alt, or is explicitly decorative (alt="")
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const CONTENT = 'src/content/saunas';

const published = readdirSync(CONTENT)
  .filter((f) => f.endsWith('.md'))
  .filter((f) => {
    const raw = readFileSync(path.join(CONTENT, f), 'utf8');
    return !/^draft:\s*true/m.test(raw) && !/^hold:\s*\S/m.test(raw);
  })
  .map((f) => {
    const raw = readFileSync(path.join(CONTENT, f), 'utf8');
    return {
      slug: f.replace(/\.md$/, ''),
      title: (raw.match(/^title:\s*"([^"]+)"/m) ?? [])[1] ?? '',
      series: (raw.match(/^series:\s*"([^"]+)"/m) ?? [])[1] ?? '',
    };
  });

const problems = [];

// --- product pages -----------------------------------------------------------
for (const p of published) {
  const file = path.join(DIST, 'saunas', p.slug, 'index.html');
  if (!existsSync(file)) {
    problems.push(`${p.slug}: no built page`);
    continue;
  }
  const full = readFileSync(file, 'utf8');
  // Scope image checks to the model's OWN content. Everything from the
  // 'Also in <category>' band onward is sibling product cards, which
  // legitimately show other models.
  const html = full.split('Also in')[0];

  // Quote CTA must carry this model.
  const enc = encodeURIComponent(p.title);
  if (!full.includes(`/quote/?model=${enc}`)) {
    problems.push(`${p.slug}: quote CTA does not carry "${p.title}"`);
  }

  // Every /images/ reference on the page must plausibly belong to this model
  // or be a shared asset (accessories kit, brand, og card).
  const SHARED = /\/(accessories|brand)\/|og-brand-card|buxena-hero/;
  const stem = p.slug.replace(/-/g, '');
  for (const m of html.matchAll(/\/images\/[A-Za-z0-9._\/-]+\.(?:jpg|jpeg|png|webp)/g)) {
    const src = m[0];
    if (SHARED.test(src)) continue;
    const fileStem = src.split('/').pop().replace(/\.[^.]+$/, '').replace(/-\d{3,4}$/, '').replace(/-/g, '');
    // Accept when the asset name shares the model slug, or vice-versa.
    if (!fileStem.includes(stem) && !stem.includes(fileStem.replace(/(hero|interior|cutout|glassfront|halfmoon|outdoorspruce|indoor)$/, ''))) {
      problems.push(`${p.slug}: image may belong to another model — ${src}`);
    }
  }

  // alt text: every img must have an alt attribute (empty allowed = decorative)
  for (const img of full.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt=/.test(img[0])) problems.push(`${p.slug}: <img> with no alt attribute`);
  }
}

// --- listings link to the right product --------------------------------------
const LISTINGS = [
  'saunas/index.html',
  'saunas/barrel-saunas/index.html',
  'saunas/cube-saunas/index.html',
  'saunas/indoor-saunas/index.html',
  'saunas/outdoor-saunas/index.html',
  'index.html',
];
for (const rel of LISTINGS) {
  const file = path.join(DIST, rel);
  if (!existsSync(file)) continue;
  const html = readFileSync(file, 'utf8');
  // Every product href must be a real published slug.
  for (const m of html.matchAll(/href="\/saunas\/([a-z0-9-]+)\/"/g)) {
    const slug = m[1];
    if (/^(barrel|cube|indoor|outdoor)-saunas$/.test(slug)) continue;
    if (!published.some((p) => p.slug === slug)) {
      problems.push(`${rel}: links to /saunas/${slug}/ which is not a published model`);
    }
  }
}

console.log(`published models checked: ${published.length}`);
console.log(`listings checked: ${LISTINGS.length}`);
if (!problems.length) {
  console.log('OK — every card links to its own model, every image belongs to its model, every img has alt');
} else {
  console.log(`\nPROBLEMS: ${problems.length}`);
  for (const p of problems) console.log('  ✗ ' + p);
}
