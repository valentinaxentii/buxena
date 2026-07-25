import type { SupabaseClient } from '@supabase/supabase-js';

// One order reserves one unit against whichever inventory row for that
// product currently has the most availability — orders don't carry a
// quantity column, so "one order = one unit" matches the schema as built.
export async function reserveInventoryUnit(supabase: SupabaseClient, productId: string | null) {
  if (!productId) return;
  const { data } = await supabase
    .from('inventory')
    .select('id, reserved, available')
    .eq('product_id', productId)
    .order('available', { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (row) {
    await supabase.from('inventory').update({ reserved: (row.reserved ?? 0) + 1 }).eq('id', row.id);
  }
}

export async function releaseInventoryUnit(supabase: SupabaseClient, productId: string | null) {
  if (!productId) return;
  const { data } = await supabase
    .from('inventory')
    .select('id, reserved')
    .eq('product_id', productId)
    .gt('reserved', 0)
    .order('reserved', { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (row) {
    await supabase.from('inventory').update({ reserved: Math.max(0, (row.reserved ?? 0) - 1) }).eq('id', row.id);
  }
}
