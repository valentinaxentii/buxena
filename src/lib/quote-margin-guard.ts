import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A quote may only go below a commercial floor after that floor has been
 * explicitly approved in the private Product Pricing control centre.  This
 * deliberately does not infer a floor from a retail price or a competitor
 * offer: either BUXENA has approved the economics or the quote remains a
 * normal manual review.
 */
export function quoteNetBeforeTax(
  subtotal: number,
  deliveryCost: number,
  installationCost: number,
  discount: number,
): number {
  return subtotal + deliveryCost + installationCost - discount;
}

export function belowApprovedFloor(netBeforeTax: number, floor: number | null | undefined): boolean {
  return typeof floor === 'number' && Number.isFinite(floor) && netBeforeTax < floor;
}

export type QuoteFloorResult =
  | { enforced: false; floor: null }
  | { enforced: true; floor: number };

/**
 * Pricing storage is intentionally a separately-applied migration.  Until it
 * exists, quote creation must keep working; it must never pretend that an
 * unverified product price is a margin floor.  Once a row is marked Approved
 * and has min_selling_price, the check is enforced on the server.
 */
export async function approvedQuoteFloor(
  supabase: SupabaseClient,
  productId: string | null | undefined,
): Promise<QuoteFloorResult> {
  if (!productId) return { enforced: false, floor: null };

  try {
    const { data, error } = await supabase
      .from('product_pricing')
      .select('status, min_selling_price')
      .eq('product_id', productId)
      .maybeSingle();

    if (error || !data || data.status !== 'Approved') return { enforced: false, floor: null };
    const floor = Number(data.min_selling_price);
    return Number.isFinite(floor) && floor >= 0
      ? { enforced: true, floor }
      : { enforced: false, floor: null };
  } catch {
    return { enforced: false, floor: null };
  }
}
