export function retailForMargin(landedCost: number | null | undefined, marginPct: number | null | undefined): number | null {
  const landed = Number(landedCost);
  const margin = Number(marginPct);
  if (!Number.isFinite(landed) || landed <= 0 || !Number.isFinite(margin) || margin < 0 || margin >= 100) return null;
  return landed / (1 - margin / 100);
}

export function grossMarginPct(landedCost: number | null | undefined, retail: number | null | undefined): number | null {
  const landed = Number(landedCost);
  const price = Number(retail);
  if (!Number.isFinite(landed) || landed < 0 || !Number.isFinite(price) || price <= 0) return null;
  return ((price - landed) / price) * 100;
}

export function markupPct(landedCost: number | null | undefined, retail: number | null | undefined): number | null {
  const landed = Number(landedCost);
  const price = Number(retail);
  if (!Number.isFinite(landed) || landed <= 0 || !Number.isFinite(price) || price < 0) return null;
  return ((price - landed) / landed) * 100;
}

export type MarketObservation = {
  currency: string;
  price: number;
  observed_on?: string | null;
  competitor?: string | null;
};

export function marketBand(rows: MarketObservation[], currency: string): { low: number; high: number; count: number; latest: string | null } | null {
  const filtered = rows.filter((row) => row.currency === currency && Number.isFinite(Number(row.price)) && Number(row.price) > 0);
  if (!filtered.length) return null;
  const prices = filtered.map((row) => Number(row.price));
  const dates = filtered.map((row) => row.observed_on).filter((value): value is string => Boolean(value)).sort();
  return {
    low: Math.min(...prices),
    high: Math.max(...prices),
    count: filtered.length,
    latest: dates.at(-1) ?? null,
  };
}
