/**
 * BUXENA — public pricing register. THE single source of truth for every
 * price a customer can see anywhere on the website.
 *
 * ============================================================================
 * IT IS DELIBERATELY EMPTY. Nothing is priced publicly yet.
 * ============================================================================
 *
 * The founders are collecting real U.S. competitor quotes and analysing landed
 * cost before setting retail prices (see BUXENA_V2_PRICING_AUDIT.md). Until a
 * price is APPROVED IN WRITING by a founder, every model shows "Request
 * Pricing" and the enquiry funnel does the selling. That is a deliberate
 * commercial position, not an unfinished feature.
 *
 * WHAT MAY GO IN THIS FILE
 *   Only founder-approved public retail figures. NEVER supplier EXW, landed
 *   cost, margin targets, workbook hypotheses, competitor numbers, estimates,
 *   placeholders or test values — none of those may ever reach a customer.
 *
 * HOW TO PUBLISH A PRICE (one line, one file, no page redesign)
 *   1. Founder approves the retail figure (Admin → Pricing worksheet).
 *   2. Add an entry below, keyed by the model's internal title.
 *   3. Rebuild. The price appears automatically and consistently on the
 *      product page, product cards, category pages, the compare table and
 *      search/SEO metadata. Removing the entry reverts everything to
 *      "Request Pricing" just as cleanly.
 *
 * Example (illustrative only — DO NOT UNCOMMENT without written approval):
 *   'BUH-UKU 160': {
 *     fromPrice: 'From $5,600',
 *     approvedBy: 'V. Xentii',
 *     approvedOn: '2026-09-01',
 *     note: 'Sauna only. Heater, delivery and installation quoted separately.',
 *   },
 */

/* ==========================================================================
 * LAUNCH PRICING POLICY — approved by the founder, 2026-08-13
 * ==========================================================================
 *
 * Hybrid. Only two models may carry a customer-facing price at launch:
 *
 *   UKU 160  — ELIGIBLE. Verified supplier EXW. Awaiting the founder's
 *              approved retail figure. Not chosen here.
 *   UKU 230  — ELIGIBLE (standard SKU only — see SEPARATE_SKU_VARIANTS).
 *              Verified supplier EXW. Awaiting the founder's figure.
 *
 *   ELLA H2  — HELD. Do NOT publish a price, despite verified EXW. Two
 *              unresolved items: its old admin cost ($3,400) conflicts with
 *              the documented landed cost ($2,383), and its worksheet flags a
 *              SPECIFICATION MISMATCH on the live product page — the published
 *              dimensions match no catalogue variant. Fix the specification
 *              first. A price on a page whose specs are wrong costs the sale
 *              and the trust.
 *
 *   Every other model — Request Quote. No sufficiently verified economics.
 *
 * NEVER PUBLISH THE COST BASIS. Landed cost, duty, freight, FX and margin are
 * internal. The customer sees a retail figure or nothing. In particular the
 * 15% duty rate is an ASSUMPTION pending a customs broker's classification —
 * it must not be presented, to a customer or in any public document, as a
 * confirmed rate, and no price may be justified publicly by reference to it.
 * ========================================================================== */

/**
 * Variants that are a DIFFERENT supplier SKU at a DIFFERENT cost, and so can
 * never inherit the parent model's published price.
 *
 * UKU 230 half-moon is the confirmed case: the supplier workbook prices the
 * standard UKU 230 at EUR 2,240 and the half-moon as its own SKU at EUR 2,590.
 * The product page lists "Half-moon glass back wall" in the same options array
 * as "Backrest" and "Wood door", which reads as a trim choice. The moment a
 * "From" price appears above that list, a customer reasonably assumes the
 * half-moon is included or a minor upcharge, and a salesperson quoting from
 * the published figure would under-price it by the full cost difference.
 *
 * Listing it here is the guard: `separateSkuNote()` renders a factual line
 * beneath the price, and only when a price is actually published — so today it
 * changes nothing, and on the day a figure is entered it cannot be forgotten.
 *
 * Only add a model here when a supplier document shows a distinct SKU and a
 * distinct cost. This is not the place for ordinary paid options.
 */
export const SEPARATE_SKU_VARIANTS: Record<string, string> = {
  'BUH-UKU 230':
    'The half-moon glass back wall is a separate model, not an upgrade to this one — it is priced on its own and confirmed in your written quote.',
};

/** The separate-SKU caveat for a model, or null. */
export function separateSkuNote(modelTitle: string | undefined): string | null {
  if (!modelTitle) return null;
  return SEPARATE_SKU_VARIANTS[modelTitle.trim()] ?? null;
}

export interface ApprovedPrice {
  /** Customer-facing sauna-only price, pre-formatted, e.g. "From $5,600". */
  fromPrice?: string;
  /** Customer-facing complete-package price, e.g. "Complete from $7,100". */
  completeFromPrice?: string;
  /** Show "Project Pricing" instead of a figure (bespoke/large projects). */
  projectPricing?: boolean;
  /** Who approved it — required for the audit trail. */
  approvedBy: string;
  /** ISO date of approval — required for the audit trail. */
  approvedOn: string;
  /** What the figure does and does not include. Shown as fine print. */
  note?: string;
}

/**
 * Keyed by the model's internal title exactly as it appears in content
 * frontmatter (e.g. "BUH-ELLA H2"), so a typo can never silently mis-price a
 * different model — an unmatched key simply yields no price.
 */
export const APPROVED_PRICES: Record<string, ApprovedPrice> = {
  // Intentionally empty — see the header. Nothing is approved for publication.
};

/** Every model currently carrying an approved public price. */
export const pricedModels = (): string[] => Object.keys(APPROVED_PRICES);

/**
 * The approved price for a model, or null when none is approved.
 * `frontmatterFallback` accepts a legacy `fromPrice` written directly in a
 * model's markdown; the register always wins, so pricing stays central.
 */
export function publicPrice(
  modelTitle: string | undefined,
  frontmatterFallback?: string
): ApprovedPrice | null {
  if (!modelTitle) return null;
  const entry = APPROVED_PRICES[modelTitle.trim()];
  if (entry) return entry;
  if (frontmatterFallback?.trim()) {
    return {
      fromPrice: frontmatterFallback.trim(),
      approvedBy: 'content frontmatter (legacy path)',
      approvedOn: '',
    };
  }
  return null;
}

/** The sauna-only display string, or null → callers render "Request Pricing". */
export function displayFromPrice(
  modelTitle: string | undefined,
  frontmatterFallback?: string
): string | null {
  const p = publicPrice(modelTitle, frontmatterFallback);
  if (!p) return null;
  if (p.projectPricing) return 'Project Pricing';
  return p.fromPrice ?? null;
}

/**
 * The numeric dollars inside an approved display string, for structured data.
 *
 * Search engines need a number; the register stores the customer-facing
 * wording ("From $5,600") because that is what a person reads. This reads the
 * figure back out rather than asking a founder to enter the same price twice
 * in two formats — two fields would eventually disagree, and the one a
 * customer sees is not the one Google would then be quoting.
 *
 * Returns null on anything it cannot read with certainty, and the caller then
 * emits no offer at all. A guessed number in structured data is a published
 * price, with all the same consequences.
 */
export function priceAmount(display: string | null | undefined): number | null {
  const match = (display ?? '').match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}
