import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../../lib/supabase-admin';
import { buildQuotePdf, missingQuoteFields } from '../../../../lib/pdf/build-quote-pdf';
import { getSettings } from '../../../../lib/settings';

export const prerender = false;

function slugify(text: string): string {
  return text
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'Quote';
}

export const GET: APIRoute = async ({ params, redirect }) => {
  const { id } = params;
  if (!id) return redirect('/admin/quotes');

  const supabase = createSupabaseAdminClient();

  const { data: quote, error: quoteError } = await supabase.from('quotes').select('*').eq('id', id).single();
  if (quoteError || !quote) {
    return redirect(`/admin/quotes`);
  }

  const [{ data: customer }, { data: product }, { data: items }] = await Promise.all([
    quote.customer_id
      ? supabase.from('customers').select('name, email, phone').eq('id', quote.customer_id).single()
      : Promise.resolve({ data: null }),
    quote.product_id
      ? supabase
          .from('products')
          .select('model_name, category, dimensions, capacity, timber_type, glass_configuration, heater_options, electrical_requirements, images')
          .eq('id', quote.product_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase.from('quote_items').select('description, quantity, unit_price, line_total').eq('quote_id', id).order('sort_order'),
  ]);

  const missing = missingQuoteFields({ quote, customer: customer ?? null, product: product ?? null, items: items ?? [] });
  if (missing.length > 0) {
    return redirect(`/admin/quotes/${id}?pdf_error=${encodeURIComponent(`Missing before a PDF can be generated: ${missing.join(', ')}.`)}`);
  }

  const settings = await getSettings(supabase);

  const pdfBytes = await buildQuotePdf({
    quote,
    customer: customer ?? null,
    product: product ?? null,
    items: items ?? [],
    company: {
      name: settings.company_name,
      email: settings.company_email,
      website: settings.company_website,
      tagline: settings.pdf_tagline,
      currency: settings.currency,
      address: settings.company_address,
      ein: (settings as any).company_ein ?? null,
      phone: settings.company_phone,
    },
  });

  const filename = `${slugify(settings.company_name)}-Quote-${slugify(quote.quote_number ?? id)}-${slugify(customer?.name ?? 'Customer')}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
};
