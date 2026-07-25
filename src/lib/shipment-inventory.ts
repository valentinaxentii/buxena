import type { SupabaseClient } from '@supabase/supabase-js';

// Statuses that count toward "incoming" — Draft never does (a PO that isn't
// placed yet isn't real incoming stock), Cancelled/Received are resolved.
export const ACTIVE_SHIPMENT_STATUSES = [
  'Ordered', 'In Production', 'Ready to Ship', 'In Transit', 'Arrived', 'Partially Received',
];

// inventory.incoming is derived, not hand-typed, once shipments exist for a
// product — sum of (ordered - received) across every active shipment.
export async function recomputeIncomingForProduct(supabase: SupabaseClient, productId: string) {
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
