import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase-admin';
import { buildQuotePdf, missingQuoteFields, type QuotePdfData } from '../../../lib/pdf/build-quote-pdf';
import { getSettings } from '../../../lib/settings';
import { isValidShareToken } from '../../../lib/quote-proposal';
import { publicEmail, site } from '../../../data/site';

export const prerender = false;

const DEV_PREVIEW_TOKEN = '0'.repeat(40);

function proposalVisuals(requestUrl: string): NonNullable<QuotePdfData['visuals']> {
  return {
    heaterInterior: new URL('/images/editorial/indoor-sauna-interior-view-concept.png', requestUrl).href,
    ritual: new URL('/images/editorial/sauna-ritual-birch-whisk.jpg', requestUrl).href,
    siteReadiness: new URL('/images/editorial/sauna-white-mist-floating-bench.jpg', requestUrl).href,
    coldPlunge: new URL('/images/editorial/cold-plunge-sauna-ritual.jpg', requestUrl).href,
  };
}

function slugify(text: string): string {
  return text
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'Proposal';
}

function pdfResponse(bytes: Uint8Array, filename: string, inline = false): Response {
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

function previewData(requestUrl: string): QuotePdfData {
  return {
    quote: {
      quote_number: 'BUX-PROPOSAL-1048',
      status: 'Sent',
      heater: 'Harvia electric heater package with controls and stones',
      accessories: ['Sauna stones', 'Heater guard'],
      delivery_cost: 850,
      installation_cost: 0,
      discount: 750,
      tax_rate: 6.35,
      subtotal: 21_790,
      total: 23_279.90,
      quote_date: new Date().toISOString().slice(0, 10),
      expiry_date: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10),
    },
    customer: { name: 'Valery Smith', email: null, phone: null },
    product: {
      model_name: 'BUX EDA 235',
      category: 'Outdoor barrel sauna',
      dimensions: { width: '80.7', depth: '92.5', height: '84.6', unit: 'in' },
      capacity: '4-6 people',
      timber_type: 'Nordic Spruce / Thermo Pine',
      glass_configuration: 'Tempered glass door; final glazing confirmed before order',
      heater_options: ['Harvia electric heater'],
      electrical_requirements: 'Final voltage, breaker and conductor sizing are confirmed before order.',
      images: [new URL('/images/saunas-normalized/eda-thermowood-2-35m-transparent.png', requestUrl).href],
    },
    items: [
      { description: 'BUX EDA 235 outdoor barrel sauna', quantity: 1, unit_price: 18_650, line_total: 18_650 },
      { description: 'Harvia electric heater', quantity: 1, unit_price: 1_790, line_total: 1_790 },
      { description: 'Digital control package', quantity: 1, unit_price: 500, line_total: 500 },
      { description: 'Sauna stones and heater guard', quantity: 1, unit_price: 0, line_total: 0 },
      { description: 'Residential delivery coordination', quantity: 1, unit_price: 850, line_total: 850 },
    ],
    company: {
      name: site.name,
      email: publicEmail ?? site.email,
      website: 'https://buxena.com',
      tagline: site.tagline,
      currency: 'USD',
    },
    visuals: proposalVisuals(requestUrl),
  };
}

export const GET: APIRoute = async ({ params, request }) => {
  const token = params.token ?? '';
  const inline = new URL(request.url).searchParams.get('view') === '1';

  if (import.meta.env.DEV && token === DEV_PREVIEW_TOKEN) {
    const data = previewData(request.url);
    const bytes = await buildQuotePdf(data);
    return pdfResponse(bytes, 'BUXENA-Proposal-BUX-PROPOSAL-1048-Valery-Smith.pdf', inline);
  }

  if (!isValidShareToken(token)) {
    return new Response('Proposal not found.', { status: 404 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('share_token', token)
      .maybeSingle();

    if (quoteError || !quote) return new Response('Proposal not found.', { status: 404 });

    const [{ data: customer }, { data: product }, { data: items }, settings] = await Promise.all([
      quote.customer_id
        ? supabase.from('customers').select('name, email, phone').eq('id', quote.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      quote.product_id
        ? supabase
            .from('products')
            .select('model_name, category, dimensions, capacity, timber_type, glass_configuration, heater_options, electrical_requirements, images')
            .eq('id', quote.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('quote_items')
        .select('description, quantity, unit_price, line_total')
        .eq('quote_id', quote.id)
        .order('sort_order'),
      getSettings(supabase),
    ]);

    const publicProduct = product
      ? {
          ...product,
          images: Array.isArray(product.images)
            ? product.images.map((image: string) => new URL(image, request.url).href)
            : product.images,
        }
      : null;
    const publicItems = items ?? [];
    const missing = missingQuoteFields({ quote, customer: customer ?? null, product: publicProduct, items: publicItems });
    if (missing.length > 0) {
      return new Response('This proposal PDF is not ready yet. Please contact your BUXENA advisor.', { status: 409 });
    }

    const bytes = await buildQuotePdf({
      quote,
      customer: customer ?? null,
      product: publicProduct,
      items: publicItems,
      company: {
        name: settings.company_name,
        email: settings.company_email,
        website: settings.company_website,
        tagline: settings.pdf_tagline,
        currency: settings.currency,
        address: settings.company_address,
        ein: (settings as { company_ein?: string | null }).company_ein ?? null,
        phone: settings.company_phone,
      },
      visuals: proposalVisuals(request.url),
    });

    const filename = `${slugify(settings.company_name)}-Proposal-${slugify(quote.quote_number ?? 'Proposal')}-${slugify(customer?.name ?? 'Customer')}.pdf`;
    return pdfResponse(bytes, filename, inline);
  } catch {
    return new Response('The proposal PDF could not be generated. Please contact your BUXENA advisor.', { status: 503 });
  }
};
