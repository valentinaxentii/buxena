import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase-admin';

export const prerender = false;

/**
 * Inline product creation for the Shipment Order line editor.
 * Lives under /admin so the auth middleware gates it like every admin page.
 *
 * Writes ONLY: model_name (as typed, trimmed), supplier_id (if provided),
 * is_active=true. Everything else stays NULL — deliberately incomplete
 * records, surfaced as such on the Products list.
 *
 * Duplicate guard: a case-insensitive exact match on model_name returns the
 * existing product instead of creating a second one.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: { name?: string; supplier_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  if (!name) {
    return new Response(JSON.stringify({ error: 'Model name is required.' }), { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // case-insensitive exact-name check (ilike with escaped wildcards)
  const escaped = name.replace(/[%_\\]/g, (c) => `\\${c}`);
  const { data: existing } = await supabase
    .from('products')
    .select('id, model_name, cost')
    .ilike('model_name', escaped)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ product: existing, existed: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: created, error } = await supabase
    .from('products')
    .insert({
      model_name: name,
      supplier_id: body.supplier_id || null,
      is_active: true,
    })
    .select('id, model_name, cost')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ product: created, existed: false }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
