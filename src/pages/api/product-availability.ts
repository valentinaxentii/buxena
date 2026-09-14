import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';

export const prerender = false;

type AvailabilityResponse = {
  status: 'in-stock' | 'out-of-stock';
  available: number;
};

const json = (body: AvailabilityResponse, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    // Inventory must reflect the admin record on every visit, never a stale
    // CDN/browser cache.
    'Cache-Control': 'no-store, max-age=0',
  },
});

/**
 * Public, read-only inventory status for one catalogue model.
 *
 * The browser receives only the sellable count calculated by the database
 * (`inventory.available` = in_stock - reserved). It never receives costs,
 * reservations, supplier information, or incoming shipment details.
 */
export const GET: APIRoute = async ({ url }) => {
  const model = (url.searchParams.get('model') ?? '').trim();
  const outOfStock: AvailabilityResponse = { status: 'out-of-stock', available: 0 };

  if (!model || model.length > 160) return json(outOfStock, 400);

  try {
    const supabase = createSupabaseAdminClient();
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('model_name', model)
      .eq('is_active', true);

    if (productError || !products?.length) return json(outOfStock);

    const productIds = products.map((product) => product.id);
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('available')
      .in('product_id', productIds);

    if (inventoryError) return json(outOfStock);

    const available = (inventory ?? []).reduce(
      (total, row) => total + Math.max(0, Number(row.available) || 0),
      0,
    );

    return json({
      status: available > 0 ? 'in-stock' : 'out-of-stock',
      available,
    });
  } catch {
    // Missing configuration or a database problem must never create a false
    // stock claim. The public page fails closed as Out of stock.
    return json(outOfStock);
  }
};
