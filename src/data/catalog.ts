/**
 * Shared catalog helpers — capacity bucketing for the sauna filter system.
 * Buckets are fixed (matching the ranges customers actually shop by); models
 * are tagged into every bucket their real min–max capacity overlaps.
 */

/**
 * The 8 models whose internal "BUH-..." title predates the 2026-08-16 BUX
 * rename and was deliberately left UNCHANGED (pricing.ts, model-identity.json
 * codes, CRM records and enquiry templates all key on these exact strings —
 * renaming the title itself would have broken every one of them). Every
 * other model created since then already has "BUX ..." baked directly into
 * its title, with no BUH- prefix at all.
 *
 * This set exists because "BUH-" is BUXENA's own generic internal SKU
 * prefix, used by EVERY model regardless of supplier — including NORD (Wood
 * Architects) and VIRU (Baltresto), which are NOT Capra and must never show
 * a Capra-implying "BUX" brand. A blanket "strip BUH-, add BUX" regex would
 * silently mislabel those too, so the BUX substitution is only ever applied
 * to a title in this exact list, verified against model-identity.json's own
 * supplier field.
 */
const RENAMED_CAPRA_TITLES = new Set([
  'BUH-ELLA H1', 'BUH-ELLA H2', 'BUH-ILLI H1', 'BUH-ILLI H2',
  'BUH-ALLA H1', 'BUH-ALLA H2', 'BUH-UKU 160', 'BUH-UKU 230',
]);

/**
 * Customer-facing product name. "BUH-" is the internal SKU prefix — it stays
 * in content frontmatter, form values, tracking payloads and the CRM (where
 * consistency with admin/products matters), but is never shown as the primary
 * name a customer reads. "BUH-VIRU Grand 6.0m" displays as "VIRU Grand 6.0m".
 * The 8 renamed Capra models display with a "BUX " brand instead — see
 * RENAMED_CAPRA_TITLES above for why this can't be a blanket regex.
 */
export const displayTitle = (title: string) =>
  RENAMED_CAPRA_TITLES.has(title) ? title.replace(/^BUH-/i, 'BUX ') : title.replace(/^BUH-/i, '');
export const CAPACITY_BUCKETS = ['2–3', '3–4', '4–5', '5–6', '6–8'] as const;
export type CapacityBucket = (typeof CAPACITY_BUCKETS)[number];

const BUCKET_RANGES: Record<CapacityBucket, [number, number]> = {
  '2–3': [2, 3],
  '3–4': [3, 4],
  '4–5': [4, 5],
  '5–6': [5, 6],
  '6–8': [6, 8],
};

/** Which capacity buckets does a [min, max] people range genuinely overlap? */
export function capacityBuckets(min?: number, max?: number): CapacityBucket[] {
  if (min == null && max == null) return [];
  const lo = min ?? max!;
  const hi = max ?? min!;
  return CAPACITY_BUCKETS.filter((b) => {
    const [bLo, bHi] = BUCKET_RANGES[b];
    return lo <= bHi && hi >= bLo;
  });
}

/**
 * Catalogue order: photographed models first, then the curated `order`.
 *
 * Sixteen of the thirty-two models lost their photography to the image-rights
 * audit — their only picture had no identifiable owner, so it could not be
 * licensed and had to go. Sorted purely by `order`, those sixteen scattered
 * through every grid, and the first screen of the catalogue became mostly
 * cards with no product visible. A visitor decides whether this is a serious
 * shop on that first screen.
 *
 * Within each group the curated `order` is preserved exactly, so this is a
 * tie-break and not a re-ranking. It also undoes itself: as supplier
 * photography arrives, models rejoin the front automatically and the original
 * sequence returns with the last one. Nothing to remember to revert.
 */
export function byPhotographedThenOrder(
  a: { data: { order: number; heroImage?: { src?: string } } },
  b: { data: { order: number; heroImage?: { src?: string } } }
): number {
  const pictured = Number(Boolean(b.data.heroImage?.src)) - Number(Boolean(a.data.heroImage?.src));
  return pictured !== 0 ? pictured : a.data.order - b.data.order;
}

/** Capra publishes one family photograph for every depth in these ranges.
 * Rendering that same photograph as 4–5 separate neighbouring cards makes the
 * catalogue look broken and implies unique model photography that does not
 * exist. Keep every SKU/page, but present these ranges once with direct size
 * links to every individual model. Used by every listing page (the main
 * catalogue and each location/type page), not just one — a family series
 * shows up wherever its models are listed. */
const FAMILY_PHOTO_SERIES = new Set(['EKE', 'SUSI', 'ITI']);

export interface FamilyGroupedCard<T> {
  representative: T;
  title?: string;
  tagline?: string;
  variants?: { slug: string; label: string }[];
}

/** Collapse repeated-family-photo series into one card each, with the rest
 * of `items` passed through unchanged. Preserves `items`' existing order. */
export function groupFamilyPhotoSeries<T extends { id: string; data: { series?: string; title: string } }>(
  items: T[]
): FamilyGroupedCard<T>[] {
  const seenSeries = new Set<string>();
  const cards: FamilyGroupedCard<T>[] = [];

  for (const item of items) {
    const series = item.data.series ?? '';
    if (!FAMILY_PHOTO_SERIES.has(series)) {
      cards.push({ representative: item });
      continue;
    }
    if (seenSeries.has(series)) continue;
    seenSeries.add(series);

    const members = items
      .filter((candidate) => candidate.data.series === series)
      .sort((a, b) => {
        const an = Number(a.data.title.match(/(\d+)(?!.*\d)/)?.[1] ?? 0);
        const bn = Number(b.data.title.match(/(\d+)(?!.*\d)/)?.[1] ?? 0);
        return an - bn;
      });
    // EKE 160 has a verified exact-model image from Capra's live product page;
    // prefer it for the grouped EKE card instead of the generic family render.
    const representative = series === 'EKE'
      ? (members.find((member) => member.data.title === 'BUX EKE 160') ?? members[0] ?? item)
      : (members[0] ?? item);
    const variants = members.map((member) => ({
      slug: member.id,
      label: `${member.data.title.match(/(\d+)(?!.*\d)/)?.[1] ?? member.data.title} cm`,
    }));

    cards.push({
      representative,
      title: `BUX ${series}`,
      tagline: `${members.length} available depths. Choose the size that fits your space.`,
      variants,
    });
  }

  return cards;
}
