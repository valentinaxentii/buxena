import type { SupabaseClient } from '@supabase/supabase-js';
import { recomputeInventoryFromUnits } from './inventory-units';
import { ACTIVE_SHIPMENT_STATUSES } from './shipment-statuses';

export { ACTIVE_SHIPMENT_STATUSES };

// inventory.incoming is derived, not hand-typed, once shipments exist for a
// product — sum of (ordered - received) across every active shipment.
//
// Unit-tracked products (products.unit_tracked) are the ONE exception: for
// those, inventory_units is the sole authoritative source for BOTH in_stock
// and incoming (see recomputeInventoryFromUnits in inventory-units.ts) — this
// quantity-math version never runs for them, so a unit-tracked product's
// stock numbers only ever have one writer. Every other product keeps the
// original behaviour below, unchanged.
export async function recomputeIncomingForProduct(supabase: SupabaseClient, productId: string) {
  const { data: product } = await supabase.from('products').select('unit_tracked').eq('id', productId).maybeSingle();
  if (product?.unit_tracked) {
    await recomputeInventoryFromUnits(supabase, productId);
    return;
  }

  const { data: items } = await supabase
    .from('shipment_items')
    .select('quantity, quantity_received, shipments!inner(status)')
    .eq('product_id', productId)
    .in('shipments.status', ACTIVE_SHIPMENT_STATUSES);

  const incoming = (items ?? []).reduce(
    (sum: number, i: any) => sum + Math.max(0, (i.quantity ?? 0) - (i.quantity_received ?? 0)),
    0
  );

  const { data: invRows } = await supabase.from('inventory').select('id').eq('product_id', productId).limit(1);
  if (invRows && invRows.length > 0) {
    await supabase.from('inventory').update({ incoming }).eq('id', invRows[0].id);
  } else if (incoming > 0) {
    await supabase.from('inventory').insert({ product_id: productId, incoming });
  }
}

export async function recomputeIncomingForShipment(supabase: SupabaseClient, shipmentId: string) {
  const { data: items } = await supabase.from('shipment_items').select('product_id').eq('shipment_id', shipmentId);
  const productIds = [...new Set((items ?? []).map((i: any) => i.product_id as string))];
  for (const productId of productIds) {
    await recomputeIncomingForProduct(supabase, productId);
  }
}
