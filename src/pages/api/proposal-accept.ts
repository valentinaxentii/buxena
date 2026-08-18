import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import { checkRateLimit } from '../../lib/rate-limit';
import { isValidShareToken, isAcceptable } from '../../lib/quote-proposal';
import { isLeadSafeMode, safeModeReason } from '../../lib/safe-mode';
import { sendProposalAcceptanceEmails } from '../../lib/proposal-email';

export const prerender = false;

/**
 * A customer accepting their personalized proposal.
 *
 * WHAT THIS DELIBERATELY IS NOT: a payment, an invoice, or a contract. It
 * records an intention and a timestamp, sets the quote to Accepted, and leaves
 * a salesperson to take it from there. The page says exactly that before the
 * button, and this endpoint must never do more than the page promises.
 *
 * EVERYTHING THAT MATTERS IS RE-DECIDED SERVER-SIDE. The request carries a
 * token and a name — nothing else is read from it. Price, status, expiry and
 * eligibility all come from the row. A customer cannot accept an expired
 * proposal, accept twice, or alter a figure, because none of those values are
 * accepted as input.
 */

const GENERIC = 'We could not record that just now. Please contact us and we will confirm by email.';

const redirect = (location: string) =>
  new Response(null, { status: 303, headers: { Location: location } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let token = '';
  let acceptedName = '';
  try {
    const form = await request.formData();
    token = String(form.get('token') ?? '').trim();
    acceptedName = String(form.get('acceptedName') ?? '').trim().slice(0, 120);
  } catch {
    return redirect('/proposal/invalid');
  }

  // Shape-checked before it can reach a query.
  if (!isValidShareToken(token)) return redirect('/proposal/invalid');
  if (!acceptedName) return redirect(`/proposal/${token}?error=name`);

  // A real customer accepts once. This is generous enough for a fumbled
  // submit and tight enough to stop a script hammering the endpoint. Parse the
  // token first so a throttled customer can return to their real proposal and
  // receive an actionable message instead of landing on a dead URL.
  const { allowed } = checkRateLimit(`proposal-accept:${clientAddress}`, 10, 10 * 60_000);
  if (!allowed) return redirect(`/proposal/${token}?error=rate`);

  // SAFE MODE — a staging preview must be walkable end to end without
  // mutating anything. The customer sees the same confirmation; no row moves.
  if (isLeadSafeMode()) {
    console.log(`[proposal-accept][safe-mode: ${safeModeReason()}] would accept token ending …${token.slice(-6)} for "${acceptedName}"`);
    return redirect(`/proposal/${token}?accepted=1`);
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: quote } = await supabase
      .from('quotes')
      .select('id, status, expiry_date, accepted_at, quote_number, customer_id, product_id, owner_staff_id, total')
      .eq('share_token', token)
      .maybeSingle();

    if (!quote) return redirect('/proposal/invalid');

    // Expiry, prior acceptance and status are judged from the ROW, never from
    // anything the browser sent.
    const verdict = isAcceptable(quote);
    if (!verdict.ok) return redirect(`/proposal/${token}`);

    // Conditional update: `.is('accepted_at', null)` makes a double submit —
    // two tabs, a double-click, a retried request — land exactly once. The
    // second finds no matching row and changes nothing, so the recorded name
    // and timestamp are always the first acceptance rather than the last.
    const { data: updated } = await supabase
      .from('quotes')
      .update({
        status: 'Accepted',
        accepted_at: new Date().toISOString(),
        accepted_name: acceptedName,
      })
      .eq('id', quote.id)
      .is('accepted_at', null)
      .select('id')
      .maybeSingle();

    if (updated) {
      // Timeline entry so the salesperson sees it where they already look.
      // Failure is swallowed: an audit note must never undo an acceptance the
      // customer has already been shown.
      await supabase
        .from('activities')
        .insert({
          entity_type: 'quote',
          entity_id: quote.id,
          activity_type: 'status_change',
          description: `Proposal accepted by ${acceptedName}`,
        })
        .then(() => {}, () => {});

      // Confirmation and staff notification are best-effort and happen only
      // after the one-time database update succeeds. An SMTP failure can never
      // undo or duplicate the customer's recorded acceptance.
      const [customerRow, productRow, ownerRow] = await Promise.all([
        quote.customer_id
          ? supabase.from('customers').select('name, email').eq('id', quote.customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
        quote.product_id
          ? supabase.from('products').select('model_name').eq('id', quote.product_id).maybeSingle()
          : Promise.resolve({ data: null }),
        quote.owner_staff_id
          ? supabase.from('profiles').select('full_name').eq('id', quote.owner_staff_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const proposalUrl = new URL(`/proposal/${token}`, request.url).href;
      await sendProposalAcceptanceEmails({
        acceptedName,
        customerName: (customerRow.data as any)?.name,
        customerEmail: (customerRow.data as any)?.email,
        proposalUrl,
        adminUrl: new URL(`/admin/quotes/${quote.id}`, request.url).href,
        quoteNumber: quote.quote_number ?? 'Proposal',
        modelName: (productRow.data as any)?.model_name,
        expiryDate: quote.expiry_date,
        advisorName: (ownerRow.data as any)?.full_name,
        total: Number(quote.total ?? 0),
      });
    }

    return redirect(`/proposal/${token}?accepted=1`);
  } catch (e) {
    // The customer gets one plain sentence; the detail goes to the log.
    console.error('[proposal-accept] failed:', e instanceof Error ? e.message : e);
    return redirect(`/proposal/${token}?error=1`);
  }
};

export const GET: APIRoute = async () =>
  new Response(GENERIC, { status: 405, headers: { Allow: 'POST' } });
