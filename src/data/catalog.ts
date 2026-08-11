/**
 * Shared catalog helpers — capacity bucketing for the sauna filter system.
 * Buckets are fixed (matching the ranges customers actually shop by); models
 * are tagged into every bucket their real min–max capacity overlaps.
 */

/**
 * Customer-facing product name. "BUH-" is the internal SKU prefix — it stays
 * in content frontmatter, form values, tracking payloads and the CRM (where
 * consistency with admin/products matters), but is never shown as the primary
 * name a customer reads. "BUH-ELLA H2" displays as "ELLA H2".
 */
export const displayTitle = (title: string) => title.replace(/^BUH-/i, '');
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
