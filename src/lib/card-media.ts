/**
 * Card media for cards built in the BROWSER, not by Astro.
 *
 * WHY THIS EXISTS
 * ---------------
 * Astro-rendered grids all go through ProductCard → Figure.astro, which has
 * handled the no-photograph case correctly since the image-rights audit: no
 * `src` means a designed placeholder carrying a factual label ("EDA · Barrel"),
 * never an <img>.
 *
 * Two surfaces build their cards client-side and so never touched Figure:
 * the Sauna Advisor shortlist and See It In My Space. Both did this:
 *
 *     <img src="${model.heroImage?.src ?? ''}" alt="...">
 *
 * `?? ''` looks like a guard and is the opposite of one. An empty `src`
 * resolves against the current document, so the browser fetches the HTML page,
 * fails to decode it as an image, and paints the ALT TEXT in the card. Sixteen
 * of thirty-five models have no `src` — every EDA — so the advisor showed a
 * broken image for any shortlist containing one. The founder hit it on the very
 * first result.
 *
 * The rule this module enforces: an <img> element is created ONLY when there is
 * a real src, and even then a decode failure swaps in the placeholder rather
 * than leaving alt text on display. A missing photograph is a designed state; a
 * broken image never is.
 */

/** Fields needed to render a card's media. A lean subset of the catalog. */
export interface CardMediaModel {
  title: string;
  series?: string;
  productType?: string;
  heroImage?: { src?: string; alt?: string };
}

/**
 * HTML-escape a value bound for a template string.
 *
 * These cards are assembled with `innerHTML`, so every interpolated value needs
 * escaping. The content is authored by BUXENA rather than submitted by
 * visitors, so this is not closing an active hole — but an apostrophe in a
 * tagline breaking an attribute is a real and ordinary failure, and the same
 * escaping removes the injection question entirely.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Customer-facing name — the BUH- SKU prefix stays internal. Mirrors catalog.ts displayTitle(). */
export function shownName(title: string): string {
  return String(title ?? '').replace(/^BUH-/i, '');
}

/**
 * The factual label shown on a placeholder, e.g. "EDA · Barrel".
 *
 * Same construction ProductCard passes to Figure, so a model without
 * photography looks identical whether its card was rendered by Astro or by the
 * browser. Only catalog facts — never a claim.
 */
export function mediaLabel(model: CardMediaModel): string {
  return [model.series, model.productType].filter(Boolean).join(' · ');
}

/** The placeholder itself. Matches Figure.astro's production treatment. */
function placeholderHtml(model: CardMediaModel, alt: string): string {
  const label = mediaLabel(model);
  return (
    `<div class="card-ph" role="img" aria-label="${escapeHtml(alt)}">` +
    `<span class="card-ph__grain" aria-hidden="true"></span>` +
    (label ? `<span class="card-ph__label">${escapeHtml(label)}</span>` : '') +
    `</div>`
  );
}

/**
 * The inner HTML of a card's media box.
 *
 * A real <img> only when there is a real src. Otherwise the placeholder — so
 * `src=""` can never be emitted.
 */
export function cardMediaHtml(model: CardMediaModel): string {
  const alt = model.heroImage?.alt || shownName(model.title);
  const src = model.heroImage?.src;

  // Trim before testing: a whitespace-only src is as broken as an empty one.
  if (!src || !String(src).trim()) return placeholderHtml(model, alt);

  return (
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" ` +
    `data-card-img data-card-label="${escapeHtml(mediaLabel(model))}" />`
  );
}

/**
 * Runtime fail-safe: if a declared image 404s or fails to decode, replace it
 * with the placeholder.
 *
 * The build-time check (scripts/image-integrity.mjs) proves every declared src
 * exists in the repo, so this should never fire. It is here for the cases a
 * repo check cannot cover — a CDN hiccup, a partial deploy, a corrupt file. The
 * cost is a few lines; the failure it prevents is alt text sitting where a
 * premium product photograph should be.
 *
 * Uses a listener rather than an inline `onerror` attribute so it survives a
 * strict Content-Security-Policy.
 */
export function attachImageFallback(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>('img[data-card-img]').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        const label = img.dataset.cardLabel ?? '';
        const alt = img.getAttribute('alt') ?? '';
        const ph = document.createElement('div');
        ph.className = 'card-ph';
        ph.setAttribute('role', 'img');
        ph.setAttribute('aria-label', alt);

        const grain = document.createElement('span');
        grain.className = 'card-ph__grain';
        grain.setAttribute('aria-hidden', 'true');
        ph.appendChild(grain);

        if (label) {
          const span = document.createElement('span');
          span.className = 'card-ph__label';
          span.textContent = label; // textContent, so no escaping question arises
          ph.appendChild(span);
        }
        img.replaceWith(ph);
      },
      { once: true }
    );
  });
}
