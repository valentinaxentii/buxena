/**
 * "If this model isn't right, what should I look at next?"
 *
 * WHAT THIS REPLACES
 * ------------------
 * The product page previously did:
 *
 *     all.filter((s) => s.data.category === data.category && s.id !== entry.id).slice(0, 3)
 *
 * — the first three siblings in catalogue order, with no relevance to the model
 * being viewed and no explanation. A visitor looking at a two-person barrel was
 * shown whichever three models happened to sort first, which is the
 * "randomly display products" pattern the brief rules out.
 *
 * WHAT IT DOES INSTEAD
 * --------------------
 * Alternatives are chosen from VERIFIED structured fields only — location,
 * capacity, productType, series, materials — and each one carries a reason
 * derived from the same comparison that selected it, so the label can never
 * drift from the fact ("More spacious", "More compact", "Similar capacity").
 *
 * DIRECTIONAL DIVERSITY is the point. A visitor rejecting a model usually needs
 * it BIGGER or SMALLER, so the shortlist deliberately reserves a slot for each
 * direction where one exists, rather than returning three models of the same
 * size. Three near-identical alternatives answer nothing.
 *
 * NOT USED, because no verified data backs it: price tier (no approved public
 * pricing exists), footprint area (dimensions are prose strings like
 * "4.3 ft (130 cm)", not comparable numbers), and heater compatibility
 * (per-model prose, not a structured field). Sorting on any of those would mean
 * inventing the comparison.
 */

export interface RelatedCandidate {
  slug: string;
  title: string;
  location?: 'outdoor' | 'indoor';
  productType?: string;
  series?: string;
  category?: string;
  capacityMin?: number;
  capacityMax?: number;
  materials?: string[];
  order?: number;
  hasPhoto?: boolean;
}

export interface RelatedModel {
  model: RelatedCandidate;
  /** Customer-facing reason. Always true of THIS model versus the current one. */
  reason: string;
}

/** Midpoint of a model's seating range — the fairest single number to compare. */
function seats(m: RelatedCandidate): number | null {
  const lo = m.capacityMin;
  const hi = m.capacityMax;
  if (lo == null && hi == null) return null;
  if (lo == null) return hi!;
  if (hi == null) return lo;
  return (lo + hi) / 2;
}

/** Why this model is worth looking at instead — derived, never asserted. */
function reasonFor(current: RelatedCandidate, other: RelatedCandidate): string {
  const a = seats(current);
  const b = seats(other);

  if (a != null && b != null && b !== a) {
    const bigger = b > a;
    // Prefer the model's own published capacity string; it is what the card
    // shows, so the reason and the spec agree on screen.
    if (other.productType && current.productType && other.productType !== current.productType) {
      return bigger ? 'More spacious · different shape' : 'More compact · different shape';
    }
    return bigger ? 'More spacious' : 'More compact';
  }

  if (other.productType && current.productType && other.productType !== current.productType) {
    return 'Similar capacity · different shape';
  }
  if (a != null && b != null && a === b) return 'Similar capacity';
  if (other.series && other.series === current.series) return `Same ${other.series} series`;

  const shared = (other.materials ?? []).filter((m) => (current.materials ?? []).includes(m));
  if (shared.length) return `Also ${shared[0]}`;

  return 'Another model to consider';
}

/**
 * Up to `limit` alternatives to the current model.
 *
 * Placement is a HARD filter: an indoor model is not an alternative to an
 * outdoor one, whatever else it shares. Everything after that is ranking.
 */
export function relatedModels(
  current: RelatedCandidate,
  all: RelatedCandidate[],
  limit = 3
): RelatedModel[] {
  const pool = all.filter((m) => {
    if (m.slug === current.slug) return false;
    // Only constrain placement when BOTH sides state it; an unknown must not
    // silently exclude a genuinely good alternative.
    if (current.location && m.location && m.location !== current.location) return false;
    return true;
  });

  const here = seats(current);

  /** Closeness first, then same shape, then same series, then photographed. */
  const byRelevance = (x: RelatedCandidate, y: RelatedCandidate) => {
    if (here != null) {
      const dx = seats(x) == null ? Infinity : Math.abs(seats(x)! - here);
      const dy = seats(y) == null ? Infinity : Math.abs(seats(y)! - here);
      if (dx !== dy) return dx - dy;
    }
    const sx = Number(x.productType === current.productType);
    const sy = Number(y.productType === current.productType);
    if (sx !== sy) return sy - sx;
    const rx = Number(Boolean(x.series && x.series === current.series));
    const ry = Number(Boolean(y.series && y.series === current.series));
    if (rx !== ry) return ry - rx;
    // A photographed alternative makes a better card. Pure tie-breaker: it
    // never overrides relevance, so it cannot distort what is recommended.
    if (Boolean(x.hasPhoto) !== Boolean(y.hasPhoto)) return x.hasPhoto ? -1 : 1;
    return (x.order ?? 999) - (y.order ?? 999);
  };

  const picked: RelatedCandidate[] = [];

  // Reserve one slot in each direction, so the section answers "bigger?" and
  // "smaller?" rather than returning three of the same size.
  if (here != null && limit >= 2) {
    const smaller = pool.filter((m) => seats(m) != null && seats(m)! < here).sort(byRelevance)[0];
    const bigger = pool.filter((m) => seats(m) != null && seats(m)! > here).sort(byRelevance)[0];
    if (smaller) picked.push(smaller);
    if (bigger) picked.push(bigger);
  }

  for (const m of [...pool].sort(byRelevance)) {
    if (picked.length >= limit) break;
    if (!picked.some((p) => p.slug === m.slug)) picked.push(m);
  }

  return picked
    .slice(0, limit)
    .sort(byRelevance)
    .map((model) => ({ model, reason: reasonFor(current, model) }));
}
