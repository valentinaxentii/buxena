import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Website Enquiries -> Lead -> Quote conversion logic, centralized here.
 * Every write path re-checks lead_id/quote_id server-side immediately before
 * inserting, so duplicate conversion is blocked even under a double-submit.
 */

function normalizeModelName(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/^buh-/, '').trim();
}

/** Exact match only (after stripping the admin "BUH-" prefix) — never a fuzzy guess. */
export function matchProductBySaunaInterest(
  products: { id: string; model_name: string }[],
  saunaInterest: string | null | undefined
): { id: string; model_name: string } | null {
  const target = normalizeModelName(saunaInterest);
  if (!target) return null;
  return products.find((p) => normalizeModelName(p.model_name) === target) ?? null;
}

/**
 * Audit logging is deliberately best-effort: a CRM state write is the source
 * of truth and must not be reported as failed merely because the secondary
 * activity timeline write had a transient error.
 */
async function logEnquiryActivity(supabase: SupabaseClient, enquiryId: string, description: string, staffId: string | null | undefined) {
  const { error } = await supabase.from('activities').insert({
    entity_type: 'enquiry',
    entity_id: enquiryId,
    activity_type: 'status_change',
    description,
    staff_id: staffId ?? null,
  });
  if (error) console.error('[enquiry-conversion] activity log failed:', error);
}

function enquiryOrigin(enquiry: any): string {
  const source = typeof enquiry?.source === 'string' && enquiry.source.trim() ? enquiry.source.trim() : 'Website';
  return `Original website enquiry source: ${source}`;
}

export async function markEnquiryContacted(supabase: SupabaseClient, enquiryId: string, staffId?: string | null) {
  const { data: enquiry, error: readError } = await supabase
    .from('enquiries')
    .select('status, contacted_at')
    .eq('id', enquiryId)
    .single();
  if (readError || !enquiry) throw new Error('Could not load the enquiry. Please try again.');

  const patch: Record<string, unknown> = {};
  if (!enquiry.contacted_at) patch.contacted_at = new Date().toISOString();
  if (enquiry.status === 'New') patch.status = 'Contacted';

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase.from('enquiries').update(patch).eq('id', enquiryId);
    if (updateError) throw new Error('Could not mark the enquiry as contacted. Please try again.');
    await logEnquiryActivity(supabase, enquiryId, 'Contacted', staffId);
  }
  return { ok: true as const };
}

export async function changeEnquiryStatus(supabase: SupabaseClient, enquiryId: string, status: string, staffId?: string | null) {
  const { error } = await supabase.from('enquiries').update({ status }).eq('id', enquiryId);
  if (error) throw new Error('Could not update the enquiry status. Please try again.');
  await logEnquiryActivity(supabase, enquiryId, `Status changed to ${status}`, staffId);
  return { ok: true as const };
}

export async function convertEnquiryToLead(supabase: SupabaseClient, enquiryId: string, staffId?: string | null) {
  const { data: enquiry } = await supabase.from('enquiries').select('*').eq('id', enquiryId).single();
  if (!enquiry) return { ok: false as const, reason: 'NOT_FOUND' as const };
  if (enquiry.lead_id) return { ok: false as const, reason: 'ALREADY_CONVERTED' as const, leadId: enquiry.lead_id };

  const { data: products } = await supabase.from('products').select('id, model_name');
  const match = matchProductBySaunaInterest(products ?? [], enquiry.sauna_interest);
  const leadNotes = [enquiryOrigin(enquiry), enquiry.message || ''].filter(Boolean).join('\n\n');

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      name: enquiry.name || enquiry.email || enquiry.phone || 'Website enquiry',
      email: enquiry.email,
      phone: enquiry.phone,
      // Keep the broad acquisition channel stable for reporting; preserve the
      // exact form/advisor origin in notes and the linked source enquiry.
      source: 'Website',
      product_id: match?.id ?? null,
      notes: leadNotes || null,
    })
    .select('id')
    .single();
  if (error || !lead) return { ok: false as const, reason: error?.message ?? 'INSERT_FAILED' };

  const { data: updated } = await supabase
    .from('enquiries')
    .update({ lead_id: lead.id })
    .eq('id', enquiryId)
    .is('lead_id', null)
    .select('id')
    .maybeSingle();
  if (!updated) {
    await supabase.from('leads').delete().eq('id', lead.id);
    const { data: current } = await supabase.from('enquiries').select('lead_id').eq('id', enquiryId).single();
    return { ok: false as const, reason: 'ALREADY_CONVERTED' as const, leadId: current?.lead_id ?? null };
  }

  await logEnquiryActivity(supabase, enquiryId, 'Converted to Lead', staffId);
  return { ok: true as const, leadId: lead.id };
}

/** Finds a customer by email (case-insensitive) or creates one from the enquiry's contact info. */
async function resolveOrCreateCustomer(supabase: SupabaseClient, enquiry: any) {
  if (enquiry.email) {
    const { data: existing } = await supabase.from('customers').select('id').ilike('email', enquiry.email).limit(1).maybeSingle();
    if (existing) return existing.id as string;
  }
  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      name: enquiry.name || enquiry.email || enquiry.phone || 'Website enquiry',
      email: enquiry.email,
      phone: enquiry.phone,
      zip: enquiry.location || null,
      lead_source: 'Website',
      notes: enquiryOrigin(enquiry),
    })
    .select('id')
    .single();
  if (error || !created) throw new Error('Could not create the customer record for this quote. Please try again.');
  return created.id as string;
}

export async function createQuoteFromEnquiry(supabase: SupabaseClient, enquiryId: string, staffId?: string | null) {
  const { data: enquiry } = await supabase.from('enquiries').select('*').eq('id', enquiryId).single();
  if (!enquiry) return { ok: false as const, reason: 'NOT_FOUND' as const };
  if (enquiry.quote_id) return { ok: false as const, reason: 'ALREADY_CONVERTED' as const, quoteId: enquiry.quote_id };

  const { data: products } = await supabase.from('products').select('id, model_name');
  const match = matchProductBySaunaInterest(products ?? [], enquiry.sauna_interest);
  const customerId = await resolveOrCreateCustomer(supabase, enquiry);

  const quoteDate = new Date().toISOString().slice(0, 10);
  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      quote_number: `Q-${Date.now().toString(36).toUpperCase()}`,
      customer_id: customerId,
      lead_id: enquiry.lead_id ?? null,
      product_id: match?.id ?? null,
      quote_date: quoteDate,
      status: 'Draft',
    })
    .select('id')
    .single();
  if (error || !quote) return { ok: false as const, reason: 'QUOTE_CREATE_FAILED' as const };

  const { data: updated } = await supabase
    .from('enquiries')
    .update({ quote_id: quote.id, status: ['Won', 'Lost'].includes(enquiry.status) ? enquiry.status : 'Quoted' })
    .eq('id', enquiryId)
    .is('quote_id', null)
    .select('id')
    .maybeSingle();
  if (!updated) {
    await supabase.from('quotes').delete().eq('id', quote.id);
    const { data: current } = await supabase.from('enquiries').select('quote_id').eq('id', enquiryId).single();
    return { ok: false as const, reason: 'ALREADY_CONVERTED' as const, quoteId: current?.quote_id ?? null };
  }

  await logEnquiryActivity(supabase, enquiryId, 'Quote created', staffId);
  return { ok: true as const, quoteId: quote.id };
}
