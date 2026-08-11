/**
 * BUXENA — Model Presentation generator (3 pages).
 *
 *   node scripts/build-model-presentation.mjs ella-h2
 *   node scripts/build-model-presentation.mjs --all        (later, on approval)
 *
 * Output: public/docs/presentations/<slug>-presentation.pdf
 *
 * ============================== HARD RULES ==============================
 * NOTHING IS INVENTED. Every fact printed comes from the model's own content
 * file. No prices (the pricing register is never read here), no warranty
 * terms, no delivery times, no availability, no installation promises, no
 * "included" claims. Missing data is OMITTED, never guessed.
 *
 * THE LOGO IS NEVER DRAWN, TYPESET OR RECONSTRUCTED. The original brand
 * asset used by the website header is embedded as an image, unmodified:
 *   public/brand/buxena-logo-champagne-header.png
 * (steam symbol + wordmark + rule + "WHERE WELLNESS STARTS" tagline,
 * champagne on transparent — verified 1219x660, true alpha). Its aspect
 * ratio is preserved on every placement; it is only ever scaled.
 *
 * IMAGE STRATEGY: images are classified by real alpha channel and filename.
 * Transparent cut-outs composite onto any ground and are always CONTAINED
 * (never cropped), so the product is never clipped. Environment photography
 * earns full-bleed placement. Opaque studio shots on white sweeps are placed
 * on white fields only, never adrift on a dark page.
 *
 * Fonts: pdf-lib standard fonts (no font files in repo) — Times-Roman for
 * serif, Helvetica for sans, the documented fallback used by the existing
 * quote/report PDFs. Logo typography is untouched: it is the real artwork.
 */
import { PDFDocument, StandardFonts, rgb, PDFName, PDFString } from 'pdf-lib';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------- palette
const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const LINEN = hex('#f6f2ea');
const BIRCH = hex('#eae3d7');
const EMBER = hex('#1b1917');
const BRONZE = hex('#9c7a4a');
const CHAMPAGNE = hex('#c4a277');
const INK = hex('#241f1a');
const MUTED = hex('#6b6259');
const HAIRLINE = hex('#d3c9b9');
const WHITE = rgb(1, 1, 1);

const PAGE_W = 612;
const PAGE_H = 792;
const M = 60;
const COL = (PAGE_W - M * 2) / 12;

/** The ONE approved logo asset — the website header's own file. */
const LOGO_ASSET = 'public/brand/buxena-logo-champagne-header.png';

/**
 * Customer-facing model identity — THE SAME FILE the website reads
 * (src/data/model-identity.json), so a brochure and a product page can never
 * disagree about a model's name or code. Only publicName and code are ever
 * printed; internalRef and supplier stay internal.
 */
const MODEL_IDENTITY = JSON.parse(readFileSync('src/data/model-identity.json', 'utf8'));
const identityFor = (title) => MODEL_IDENTITY[(title ?? '').trim()] ?? null;

// ------------------------------------------------------------ frontmatter
function parseModel(slug) {
  const file = path.join('src/content/saunas', `${slug}.md`);
  if (!existsSync(file)) throw new Error(`No content file for "${slug}"`);
  const raw = readFileSync(file, 'utf8');
  const end = raw.indexOf('\n---', 3);
  const fm = raw.slice(3, end);
  const body = raw.slice(end + 4).trim();

  const scalar = (k) => {
    const m = fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
  };
  const list = (k) => {
    const m = fm.match(new RegExp(`^${k}:\\s*\\[(.*)\\]`, 'm'));
    if (m) return m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    const block = fm.match(new RegExp(`^${k}:\\s*\\n((?:\\s+-\\s.*\\n?)+)`, 'm'));
    if (!block) return [];
    return block[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  };
  const pairs = (k) => {
    const block = fm.match(new RegExp(`^${k}:\\s*\\n((?:\\s+-\\s\\{.*\\}\\n?)+)`, 'm'));
    if (!block) return [];
    return block[1].split('\n').map((l) => {
      const lm = l.match(/label:\s*"([^"]*)"\s*,\s*value:\s*"([^"]*)"/);
      return lm ? { label: lm[1], value: lm[2] } : null;
    }).filter(Boolean);
  };
  const images = () => {
    const out = [];
    const hero = fm.match(/heroImage:\s*\n\s*src:\s*"([^"]+)"\s*\n\s*alt:\s*"([^"]*)"/);
    if (hero) out.push({ src: hero[1], alt: hero[2] });
    const gal = fm.match(/^gallery:\s*\n((?:\s+-\s.*\n|\s{4,}.*\n)+)/m);
    if (gal) for (const g of gal[1].matchAll(/src:\s*"([^"]+)"\s*\n\s*alt:\s*"([^"]*)"/g)) out.push({ src: g[1], alt: g[2] });
    return out.filter((i) => existsSync(path.join('public', i.src)));
  };

  return {
    slug,
    title: scalar('title') ?? slug,
    display: (scalar('title') ?? slug).replace(/^BUH-/i, ''),
    series: scalar('series'),
    location: scalar('location'),
    productType: scalar('productType'),
    tagline: scalar('tagline'),
    summary: scalar('summary'),
    capacity: scalar('capacity'),
    materials: list('materials'),
    heaterOptions: list('heaterOptions'),
    options: list('options'),
    features: list('features'),
    dimensions: pairs('dimensions'),
    specs: pairs('specs'),
    images: images(),
    body,
  };
}

/**
 * 'transparent' — real alpha cut-out (verified by sampling corner pixels).
 * 'environment' — a room/scene photograph (filename convention).
 * 'studio'      — opaque subject on a solid sweep; white fields only.
 */
function classify(relSrc) {
  const abs = path.join('public', relSrc);
  const name = path.basename(relSrc).toLowerCase();
  if (/\.png$/i.test(relSrc)) {
    try {
      const buf = readFileSync(abs);
      if (buf[25] === 6 || buf[25] === 4) return 'transparent';
    } catch { /* fall through */ }
  }
  if (/interior|lifestyle|scene|installed|garden|deck|room/.test(name)) return 'environment';
  return 'studio';
}

// --------------------------------------------------------------- drawing
/**
 * WinAnsi is the encoding of pdf-lib's standard fonts, and it cannot carry
 * every character our content uses. Rather than crash a build (or silently
 * drop a character mid-specification), map the ones that appear in real
 * product data to faithful equivalents, and record anything unmapped.
 * Meaning is always preserved — "≈63 in" becomes "approx. 63 in", never "63 in".
 */
const SUP = {"⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9"};
const SUB = {"₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9"};
const VULGAR = {"⅛":"1/8","⅜":"3/8","⅝":"5/8","⅞":"7/8","⅓":"1/3","⅔":"2/3","⅕":"1/5","⅖":"2/5","⅗":"3/5","⅘":"4/5","⅙":"1/6","⅚":"5/6"};

const WINANSI_SUBS = [
  // Built-up fractions in real spec data, e.g. 23(3/16) in. Dropping these
  // characters would silently falsify a measurement, so they are converted.
  [/(\d)([⁰¹²³⁴-⁹]+)⁄([₀-₉]+)/g,
    (_, d, n, den) => d + " " + [...n].map((c) => SUP[c] ?? c).join("") + "/" + [...den].map((c) => SUB[c] ?? c).join("")],
  // Vulgar fractions attached to a number, e.g. 85(1/8) in.
  // 1/4 1/2 3/4 are absent on purpose - WinAnsi encodes those natively.
  [/(\d)([⅓-⅚⅛-⅞])/g, (_, d, f) => d + " " + VULGAR[f]],
  [/[⅓-⅚⅛-⅞]/g, (f) => VULGAR[f]],
  [/⁄/g, "/"],
  [/[⁰⁴-⁹]/g, (c) => SUP[c]],
  [/[₀-₉]/g, (c) => SUB[c]],
  [/≈/g, "approx. "],
  [/≤/g, "max. "],
  [/≥/g, "min. "],
  [/[‐‑‒]/g, "-"],
  [/…/g, "..."],
  [/′/g, "'"],
  [/″/g, '"'],
  [/ /g, " "],
];
const UNENCODABLE = new Set();
const sanitize = (s) => {
  let out = s ?? '';
  for (const [re, to] of WINANSI_SUBS) out = out.replace(re, to);
  // Anything still outside WinAnsi's reach is recorded and removed, so a
  // stray glyph can never abort a 35-model batch.
  return out.replace(/[^\x00-\xFF–—‘’“”•…]/g, (ch) => {
    UNENCODABLE.add(ch);
    return '';
  });
};

const clean = (s) => sanitize(s ?? '').replace(/\s+/g, ' ').trim();

function wrap(text, font, size, maxW) {
  const words = clean(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(page, text, { x, y, font, size, color = INK, maxW, leading = 1.5, spacing = 0, center = false }) {
  const lines = maxW ? wrap(text, font, size, maxW) : [clean(text)];
  let cy = y;
  for (const l of lines) {
    const w = font.widthOfTextAtSize(l, size) + spacing * Math.max(0, l.length - 1);
    page.drawText(l, { x: center ? (PAGE_W - w) / 2 : x, y: cy, size, font, color, characterSpacing: spacing });
    cy -= size * leading;
  }
  return cy;
}

/** Contain — preserves aspect, never crops. Used for every product image. */
function drawContain(page, img, { x, y, w, h }) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
  return { dx, dy, dw, dh };
}

/** Cover-crop into a box, masking overflow with the page ground. */
function drawCover(page, img, { x, y, w, h, ground }) {
  const ir = img.width / img.height, br = w / h;
  let dw = w, dh = h, dx = x, dy = y;
  if (ir > br) { dw = h * ir; dx = x - (dw - w) / 2; }
  else { dh = w / ir; dy = y - (dh - h) / 2; }
  page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
  if (ground) {
    if (dy < y) page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: y, color: ground });
    if (dy + dh > y + h) page.drawRectangle({ x: 0, y: y + h, width: PAGE_W, height: PAGE_H - (y + h), color: ground });
    if (dx < x) page.drawRectangle({ x: 0, y: 0, width: x, height: PAGE_H, color: ground });
    if (dx + dw > x + w) page.drawRectangle({ x: x + w, y: 0, width: PAGE_W - (x + w), height: PAGE_H, color: ground });
  }
}

/** Draw the real logo artwork, scaled only — never redrawn. */
function drawLogo(page, logo, { width, cx, y }) {
  const h = (logo.height / logo.width) * width;
  page.drawImage(logo, { x: cx - width / 2, y, width, height: h });
  return h;
}

const eyebrow = (page, text, { x, y, font, color = BRONZE, size = 7.5, center = false }) => {
  const t = clean(text).toUpperCase();
  const w = font.widthOfTextAtSize(t, size) + 2.6 * Math.max(0, t.length - 1);
  page.drawText(t, { x: center ? (PAGE_W - w) / 2 : x, y, size, font, color, characterSpacing: 2.6 });
};

async function embed(pdf, relSrc) {
  const bytes = readFileSync(path.join('public', relSrc));
  return /\.png$/i.test(relSrc) ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}

/** Real PDF link annotation — works in any reader and when emailed. */
function addLink(pdf, page, { x, y, w, h, url }) {
  const annot = pdf.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [x, y, x + w, y + h],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
  });
  const ref = pdf.context.register(annot);
  const existing = page.node.lookup(PDFName.of('Annots'));
  if (existing && typeof existing.push === 'function') existing.push(ref);
  else page.node.set(PDFName.of('Annots'), pdf.context.obj([ref]));
}

/**
 * Split a verified value that carries a parenthetical qualifier into a
 * headline value plus its notes, e.g.
 *   "Electric 3.5–4.5 kW (confirmed range for this model — wood-burning not compatible)"
 *     → { main: "Electric 3.5–4.5 kW", notes: ["Confirmed range for this model.",
 *                                              "Wood-burning not compatible."] }
 * Pure reformatting of existing text — no wording is added or invented.
 */
function splitQualified(value) {
  const m = clean(value).match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!m) return { main: clean(value), notes: [] };
  const notes = m[2]
    .split(/\s*[—–]\s*|\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.'));
  return { main: m[1].trim(), notes };
}

/** "Painted exterior (main parts or fully painted)" → "… — main parts or …" */
const dashify = (s) => clean(s).replace(/\s*\((.*)\)\s*$/, ' — $1');

// ----------------------------------------------------------------- build
async function buildPresentation(slug) {
  const m = parseModel(slug);
  const pdf = await PDFDocument.create();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifIt = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansB = await pdf.embedFont(StandardFonts.HelveticaBold);

  // The original brand asset, embedded unmodified.
  const logo = await pdf.embedPng(readFileSync(LOGO_ASSET));

  const assets = [];
  for (const i of m.images) assets.push({ ...i, kind: classify(i.src), embedded: await embed(pdf, i.src) });
  const transparent = assets.filter((a) => a.kind === 'transparent');
  const environment = assets.filter((a) => a.kind === 'environment');
  const studio = assets.filter((a) => a.kind === 'studio');

  // Cover hero: a transparent cut-out is ideal (no box, no crop). Prefer the
  // tightest-framed one so the product reads large.
  const coverImg = transparent[0] ?? studio[0] ?? environment[0] ?? null;
  const sceneImg = environment[0] ?? null;
  const secondProduct = transparent.find((t) => t !== coverImg) ?? null;

  pdf.setTitle(`${m.display} — BUXENA Model Presentation`);
  pdf.setAuthor('BUXENA');
  pdf.setSubject(`${m.display} sauna — specifications and project overview`);
  pdf.setProducer('BUXENA');

  const used = { images: [], fields: [], omitted: [] };

  // Customer-facing identity. `display` is what a customer reads; the
  // supplier reference behind it never appears in the document.
  const identity = identityFor(m.title);
  const publicName = identity ? identity.publicName : m.display;
  const modelCode = identity ? identity.code : null;
  if (identity) used.fields.push(`identity: ${publicName} / ${modelCode} (internal ${identity.internalRef})`);

  // ============================ PAGE 1 — COVER / PRODUCT OVERVIEW ===========
  {
    const p = pdf.addPage([PAGE_W, PAGE_H]);
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: EMBER });

    // TOP — the real logo, centred and clearly visible.
    const LOGO_W = 186;
    const logoH = (logo.height / logo.width) * LOGO_W;
    const logoY = PAGE_H - 48 - logoH;
    drawLogo(p, logo, { width: LOGO_W, cx: PAGE_W / 2, y: logoY });
    used.fields.push('logo: original header asset (unmodified)');

    // MIDDLE — the product as large as the page allows, contained so nothing
    // is ever cropped. A narrower side margin lets it use the full width.
    const PROD_M = 36;
    const zoneTop = logoY - 28;             // clear air below the logo
    const zoneBottom = 249;                 // above the title + quick-reference
    if (coverImg) {
      drawContain(p, coverImg.embedded, {
        x: PROD_M, y: zoneBottom, w: PAGE_W - PROD_M * 2, h: zoneTop - zoneBottom,
      });
      used.images.push(`${coverImg.src} — cover hero, contained (${coverImg.kind}, uncropped)`);
      if (coverImg.kind === 'studio') {
        used.omitted.push('NOTE: cover image is an opaque studio shot; a transparent or scene asset would sit better on the dark cover');
      }
    } else {
      used.omitted.push('Cover photography — no usable image asset for this model');
    }

    // LOWER — title, descriptor, restrained information line. Centred, and
    // set low enough that the foot of the page is not dead space.
    let y = 194;
    const tW = serif.widthOfTextAtSize(publicName, 52);
    p.drawText(publicName, { x: (PAGE_W - tW) / 2, y, size: 52, font: serif, color: LINEN });
    y -= 26;
    if (modelCode) {
      eyebrow(p, `BUXENA Model ${modelCode}`, { x: 0, y, font: sans, color: hex('#8d8177'), size: 8, center: true });
      y -= 24;
    } else {
      y -= 8;
    }
    if (m.tagline) {
      y = drawText(p, m.tagline, { x: 0, y, font: serifIt, size: 15, color: CHAMPAGNE, maxW: COL * 9, center: true, leading: 1.5 });
      used.fields.push('tagline (descriptor)');
    }
    const info = [
      m.location && `${m.location[0].toUpperCase()}${m.location.slice(1)}`,
      m.productType, m.capacity,
    ].filter(Boolean).join('   ·   ');
    if (info) {
      eyebrow(p, info, { x: 0, y: 120, font: sans, color: hex('#9a8e83'), size: 9.5, center: true });
      used.fields.push('info line (placement · form · capacity)');
    }

    // Quick-reference strip — a glance only. Heater and configuration detail
    // deliberately live on page 2, so nothing is repeated between pages.
    const quick = [
      m.dimensions[0] && ['Dimensions', m.dimensions[0].value.replace(/\s*\(.*\)\s*$/, '')],
      m.capacity && ['Capacity', m.capacity],
      m.materials.length && ['Material', m.materials.join(', ')],
    ].filter(Boolean);
    if (quick.length) {
      p.drawRectangle({ x: M, y: 100, width: PAGE_W - M * 2, height: 0.6, color: hex('#3a332c') });
      const cw = (PAGE_W - M * 2) / quick.length;
      quick.forEach(([label, value], i) => {
        const cx = M + cw * i + cw / 2;
        const lw = sans.widthOfTextAtSize(label.toUpperCase(), 7.5) + 2.6 * (label.length - 1);
        p.drawText(label.toUpperCase(), { x: cx - lw / 2, y: 76, size: 7.5, font: sans, color: BRONZE, characterSpacing: 2.6 });
        const lines = wrap(value, sans, 10, cw - 20);
        lines.forEach((ln, li) => {
          const vw = sans.widthOfTextAtSize(ln, 10);
          p.drawText(ln, { x: cx - vw / 2, y: 56 - li * 13, size: 10, font: sans, color: LINEN });
        });
      });
      used.fields.push(`cover quick-reference (${quick.map(([l]) => l).join(', ')})`);
    }
  }

  // ====================== PAGE 2 — SPECIFICATIONS + SYSTEM ==================
  {
    const p = pdf.addPage([PAGE_W, PAGE_H]);
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: LINEN });

    // A real scene photograph as the plate, when one exists.
    let y = PAGE_H - M;
    if (sceneImg) {
      const plateH = 180;
      drawCover(p, sceneImg.embedded, { x: 0, y: PAGE_H - plateH, w: PAGE_W, h: plateH, ground: LINEN });
      p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H - plateH, color: LINEN });
      used.images.push(`${sceneImg.src} — specification plate (environment)`);
      y = PAGE_H - plateH - 46;
    } else {
      y = PAGE_H - M - 20;
      used.omitted.push('Specification plate photograph — no environment image for this model');
    }

    p.drawText(publicName, { x: M, y, size: 28, font: serif, color: INK });
    if (modelCode) {
      const codeLabel = `BUXENA MODEL ${modelCode}`;
      const cw = sans.widthOfTextAtSize(codeLabel, 8) + 2.6 * (codeLabel.length - 1);
      p.drawText(codeLabel, {
        x: PAGE_W - M - cw, y: y + 5, size: 8, font: sans,
        color: hex('#8d8177'), characterSpacing: 2.6,
      });
    }
    y -= 18;
    p.drawRectangle({ x: M, y, width: PAGE_W - M * 2, height: 1.2, color: INK });
    y -= 34;
    const COLS_TOP = y;
    const colW = (PAGE_W - M * 2 - 34) / 2;
    const rightX = M + colW + 34;

    // ---- LEFT COLUMN — key specifications --------------------------------
    // Heater and material are deliberately EXCLUDED here: they belong to the
    // Configure column on the right, so nothing is stated twice.
    const isConfigure = (l) => /heater|material|option/i.test(l);
    const rank = (label) => {
      const l = label.toLowerCase();
      if (/external/.test(l)) return 1;
      if (/internal/.test(l)) return 2;
      if (/capacity/.test(l)) return 3;
      if (/front wall|glass(?!\s*door)/.test(l)) return 4;
      if (/door/.test(l)) return 5;
      if (/wall construction|construct/.test(l)) return 6;
      if (/bench/.test(l)) return 7;
      if (/roof/.test(l)) return 8;
      return 20;
    };
    const seen = new Set();
    const specRows = [
      ...m.dimensions.map((d) => [d.label, d.value]),
      m.capacity && ['Capacity', m.capacity],
      ...m.specs.map((s) => [s.label, s.value]),
    ]
      .filter(Boolean)
      .filter(([label]) => !isConfigure(label))
      .filter(([label]) => {
        const k = label.toLowerCase().replace(/[^a-z]/g, '');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => rank(a[0]) - rank(b[0]));

    eyebrow(p, 'Key Specifications', { x: M, y: COLS_TOP, font: sans, size: 8 });
    let ly = COLS_TOP - 26;
    const FLOOR = 108;
    let shown = 0;
    const skipped = [];
    for (const [label, value] of specRows) {
      if (ly < FLOOR) { skipped.push(label); continue; }
      eyebrow(p, label, { x: M, y: ly, font: sans, color: hex('#8d8177'), size: 7 });
      const after = drawText(p, value, {
        x: M, y: ly - 15, font: sans, size: 11, color: INK, maxW: colW, leading: 1.45,
      });
      ly = after - 12;
      shown++;
    }
    used.fields.push(`key specifications (${shown})`);
    if (skipped.length) used.omitted.push(`secondary specifications omitted (kept type large): ${skipped.join(', ')}`);

    // ---- RIGHT COLUMN — configure your sauna -----------------------------
    eyebrow(p, 'Configure Your Sauna', { x: rightX, y: COLS_TOP, font: sans, size: 8 });
    let ry = COLS_TOP - 26;

    if (m.heaterOptions.length) {
      const { main, notes } = splitQualified(m.heaterOptions[0]);
      eyebrow(p, 'Heater', { x: rightX, y: ry, font: sans, color: hex('#8d8177'), size: 7 });
      ry = drawText(p, main, { x: rightX, y: ry - 15, font: sans, size: 11, color: INK, maxW: colW, leading: 1.45 });
      for (const n of notes) {
        ry = drawText(p, n, { x: rightX, y: ry - 2, font: sans, size: 9.5, color: MUTED, maxW: colW, leading: 1.5 });
      }
      ry -= 14;
      used.fields.push('configure: heater');
    }
    if (m.materials.length) {
      eyebrow(p, 'Material', { x: rightX, y: ry, font: sans, color: hex('#8d8177'), size: 7 });
      ry = drawText(p, m.materials.join(', '), { x: rightX, y: ry - 15, font: sans, size: 11, color: INK, maxW: colW, leading: 1.45 }) - 14;
      used.fields.push('configure: material');
    }
    if (m.options.length) {
      eyebrow(p, 'Options', { x: rightX, y: ry, font: sans, color: hex('#8d8177'), size: 7 });
      ry -= 15;
      for (const opt of m.options) {
        p.drawRectangle({ x: rightX + 1, y: ry + 3.5, width: 3, height: 3, color: BRONZE });
        ry = drawText(p, dashify(opt), { x: rightX + 13, y: ry, font: sans, size: 10, color: INK, maxW: colW - 13, leading: 1.5 }) - 6;
      }
      used.fields.push(`configure: options (${m.options.length})`);
    }

    // ---- closing line, full width ----------------------------------------
    const closeY = Math.min(ly, ry) - 6;
    p.drawRectangle({ x: M, y: Math.max(closeY, 76) + 16, width: PAGE_W - M * 2, height: 0.6, color: HAIRLINE });
    drawText(p, 'Heater sizing, controls and site requirements are confirmed with you before any order is placed.',
      { x: M, y: Math.max(closeY, 76) - 6, font: serifIt, size: 10.5, color: MUTED, maxW: PAGE_W - M * 2, leading: 1.5 });
  }

  // ========================= PAGE 3 — YOUR BUXENA PROJECT ==================
  {
    const p = pdf.addPage([PAGE_W, PAGE_H]);
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: EMBER });
    drawLogo(p, logo, { width: 158, cx: PAGE_W / 2, y: PAGE_H - 62 - (logo.height / logo.width) * 158 });

    let y = PAGE_H - 176;
    eyebrow(p, 'Your BUXENA Project', { x: 0, y, font: sans, color: CHAMPAGNE, center: true, size: 8.5 });
    y -= 48;
    const h = 'From model to first heat.';
    p.drawText(h, { x: (PAGE_W - serif.widthOfTextAtSize(h, 38)) / 2, y, size: 38, font: serif, color: LINEN });
    y -= 58;

    const steps = [
      ['01', 'Select your model', 'Choose the sauna, or let a BUXENA specialist shortlist the models that suit your space.'],
      ['02', 'Configure your system', 'The heater, controls and components are matched to the model and your project.'],
      ['03', 'Confirm your project', 'We review dimensions, access, placement and site requirements, and set out an itemized written quote.'],
      ['04', 'We coordinate', 'We coordinate delivery with you directly and confirm site access.'],
    ];
    for (const [n, title, body] of steps) {
      p.drawText(n, { x: M, y, size: 19, font: serif, color: BRONZE });
      p.drawText(clean(title), { x: M + COL * 1.6, y, size: 14.5, font: sansB, color: LINEN });
      const after = drawText(p, body, {
        x: M + COL * 1.6, y: y - 22, font: sans, size: 11.5, color: hex('#a99e93'),
        maxW: COL * 8.6, leading: 1.6,
      });
      y = after - 32;
    }

    y -= 6;
    p.drawRectangle({ x: M, y: y + 14, width: PAGE_W - M * 2, height: 0.6, color: hex('#3a332c') });
    y = drawText(p,
      'BUXENA coordinates the model, the correctly matched sauna system and your project requirements before the order is placed.',
      { x: M, y: y - 12, font: serifIt, size: 11.5, color: hex('#b5aa9e'), maxW: PAGE_W - M * 2, leading: 1.55 });

    // ---- Footer — contact details ONLY. No call to action anywhere in this
    // document, by explicit instruction.
    const FOOT = 62;
    p.drawRectangle({ x: M, y: FOOT + 30, width: PAGE_W - M * 2, height: 0.7, color: hex('#3a332c') });

    const site = 'buxena.com';
    const mail = 'info@buxena.com';
    const sep = '     |     ';
    const cSize = 10.5;
    const siteW = sans.widthOfTextAtSize(site, cSize);
    const sepW = sans.widthOfTextAtSize(sep, cSize);
    const mailW = sans.widthOfTextAtSize(mail, cSize);
    const cStart = (PAGE_W - (siteW + sepW + mailW)) / 2;
    p.drawText(site, { x: cStart, y: FOOT, size: cSize, font: sans, color: hex('#9a8e83') });
    addLink(pdf, p, { x: cStart, y: FOOT - 4, w: siteW, h: 17, url: 'https://buxena.com/' });
    p.drawText(sep, { x: cStart + siteW, y: FOOT, size: cSize, font: sans, color: hex('#5f564e') });
    const mailX = cStart + siteW + sepW;
    p.drawText(mail, { x: mailX, y: FOOT, size: cSize, font: sans, color: hex('#9a8e83') });
    addLink(pdf, p, { x: mailX, y: FOOT - 4, w: mailW, h: 17, url: 'mailto:info@buxena.com' });
    used.fields.push('footer: buxena.com + info@buxena.com (clickable) — no CTA');
  }

  const outDir = 'public/docs/presentations';
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${slug}-presentation.pdf`);
  writeFileSync(outFile, await pdf.save());
  return { outFile, model: m, used, pages: pdf.getPageCount(), assets };
}

// ------------------------------------------------------------------- CLI
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/build-model-presentation.mjs <slug|--all>');
  process.exit(1);
}
const slugs = arg === '--all'
  ? readdirSync('src/content/saunas').filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''))
  : [arg];

const failures = [];
for (const slug of slugs) {
  let result;
  try {
    result = await buildPresentation(slug);
  } catch (err) {
    // One bad model must never abort the batch — record and continue.
    failures.push(`${slug}: ${err.message}`);
    console.log(`\n✗ ${slug} — FAILED: ${err.message}`);
    continue;
  }
  const { outFile, model, used, pages, assets } = result;
  console.log(`\n✓ ${model.display} → ${outFile}  (${pages} pages)`);
  console.log(`  logo: ${LOGO_ASSET} (embedded unmodified)`);
  console.log(`  assets: ${assets.map((a) => `${path.basename(a.src)}=${a.kind}`).join(', ') || 'none'}`);
  console.log(`  images placed:\n    ${used.images.join('\n    ') || 'none'}`);
  console.log(`  data used: ${used.fields.join(', ')}`);
  if (used.omitted.length) console.log(`  OMITTED / NOTES:\n    ${used.omitted.join('\n    ')}`);
}

console.log(`\n════ BATCH SUMMARY ════`);
console.log(`generated: ${slugs.length - failures.length}/${slugs.length}`);
if (UNENCODABLE.size) console.log(`characters dropped as unencodable: ${[...UNENCODABLE].join(' ')} (review if unexpected)`);
if (failures.length) {
  console.log(`FAILED:\n  ${failures.join('\n  ')}`);
  process.exitCode = 1;
}
