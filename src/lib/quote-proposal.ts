/**
 * The personalized customer proposal — tokens, the customer-safe projection,
 * and discount control.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 * ----------------------------------------
 * A customer proposal must never carry an internal number. Dealer cost, unit
 * cost, margin, the margin floor and internal notes all live on the same rows
 * as the figures the customer is meant to see, so "just don't render it" is
 * one careless template edit away from publishing a margin to the person
 * you are negotiating with.
 *
 * `toCustomerProposal()` is therefore the ONLY way quote data reaches the
 * public page: it builds a new object containing exactly the fields a customer
 * may see. Anything not listed there cannot leak, because it is never copied.
 * The public route has no access to the raw row at all.
 */

export type QuoteItemKind =
  | 'sauna'
  | 'heater'
  | 'controls'
  | 'accessories'
  | 'delivery'
  | 'installation'
  | 'service'
  | 'other';

/** Display order and headings for the customer-facing package breakdown. */
export const ITEM_GROUPS: { kind: QuoteItemKind; label: string }[] = [
  { kind: 'sauna', label: 'Sauna' },
  { kind: 'heater', label: 'Heater' },
  { kind: 'controls', label: 'Controls' },
  { kind: 'accessories', label: 'Accessories' },
  { kind: 'delivery', label: 'Delivery' },
  { kind: 'installation', label: 'Installation' },
  { kind: 'service', label: 'Services' },
  { kind: 'other', label: 'Other' },
];

/**
 * How delivery and installation are being handled on THIS quote.
 *
 * Explicit states rather than a free-text line, because the failure mode is
 * a customer inferring that something is included when the quote never said
 * so. `unset` renders nothing at all — silence is correct when a salesperson
 * has not yet decided, and far better than a default that reads as a promise.
 */
export type FulfilmentState = 'unset' | 'included' | 'separate' | 'customer' | 'tbc';

export const FULFILMENT_LABELS: Record<Exclude<FulfilmentState, 'unset'>, string> = {
  included: 'Included in this proposal',
  separate: 'Quoted separately',
  customer: 'Arranged by you',
  tbc: 'To be confirmed',
};

/**
 * A URL-safe token with 160 bits of entropy.
 *
 * Not the quote's uuid: ids appear in admin URLs, server logs and CSV
 * exports, and one leaked id would expose a customer's pricing. A separate
 * token can also be rotated without touching the quote. Not sequential, so
 * nobody can walk from their own proposal to somebody else's.
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Shape check before a token is ever used in a query. */
export function isValidShareToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

export interface CustomerProposalItem {
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CustomerProposal {
  quoteNumber: string;
  customerName: string;
  quoteDate: string | null;
  expiryDate: string | null;
  expired: boolean;
  status: string;
  acceptedAt: string | null;
  modelName: string | null;
  items: CustomerProposalItem[];
  subtotal: number;
  discount: number;
  total: number;
  /** True when every figure is zero — the proposal shows no pricing at all. */
  hasPricing: boolean;
  delivery: FulfilmentState;
  installation: FulfilmentState;
  customerNotes: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

/**
 * Build the customer-visible proposal from raw rows.
 *
 * ALLOW-LIST, never a deny-list. Every returned field is named explicitly, so
 * a column added to `quotes` later — including a cost column — cannot appear
 * on the customer page by default. That is the whole design.
 */
export function toCustomerProposal(
  quote: Record<string, unknown>,
  items: Record<string, unknown>[],
  extras: {
    customerName?: string | null;
    modelName?: string | null;
    ownerName?: string | null;
    ownerEmail?: string | null;
  } = {}
): CustomerProposal {
  const mapped: CustomerProposalItem[] = (items ?? [])
    .map((raw) => ({
      // Unknown kinds fall back to 'other' rather than being dropped: a line
      // the customer is being charged for must always be visible to them.
      kind: (ITEM_GROUPS.some((g) => g.kind === raw.kind) ? raw.kind : 'other') as QuoteItemKind,
      description: String(raw.description ?? '').trim(),
      quantity: num(raw.quantity) || 1,
      unitPrice: num(raw.unit_price),
      lineTotal: num(raw.line_total),
      // NOTE: unit_cost is deliberately NOT copied.
    }))
    .filter((i) => i.description.length > 0);

  const subtotal = num(quote.subtotal);
  const discount = num(quote.discount);
  const total = num(quote.total);
  const expiry = str(quote.expiry_date);

  return {
    quoteNumber: String(quote.quote_number ?? '').trim() || 'Proposal',
    customerName: str(extras.customerName ?? null) ?? '',
    quoteDate: str(quote.quote_date),
    expiryDate: expiry,
    expired: isExpired(expiry),
    status: String(quote.status ?? 'Draft'),
    acceptedAt: str(quote.accepted_at),
    modelName: str(extras.modelName ?? null),
    items: mapped,
    subtotal,
    discount,
    total,
    hasPricing: subtotal > 0 || total > 0 || mapped.some((i) => i.lineTotal > 0),
    delivery: readFulfilment(quote.delivery_state),
    installation: readFulfilment(quote.installation_state),
    customerNotes: str(quote.customer_notes),
    ownerName: str(extras.ownerName ?? null),
    ownerEmail: str(extras.ownerEmail ?? null),
  };
}

function readFulfilment(value: unknown): FulfilmentState {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'included' || v === 'separate' || v === 'customer' || v === 'tbc' ? v : 'unset';
}

/** Past its expiry date. Date-only comparison; an expiry is a whole day. */
export function isExpired(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return String(expiryDate).slice(0, 10) < today;
}

/** Can the customer still act on this proposal? */
export function isAcceptable(quote: {
  status?: unknown;
  expiry_date?: unknown;
  accepted_at?: unknown;
}): { ok: boolean; reason?: string } {
  if (quote.accepted_at) return { ok: false, reason: 'This proposal has already been accepted.' };
  const status = String(quote.status ?? '');
  if (status === 'Declined') return { ok: false, reason: 'This proposal is no longer available.' };
  if (status === 'Converted') return { ok: false, reason: 'This proposal has already become an order.' };
  if (status === 'Draft') return { ok: false, reason: 'This proposal is not ready yet.' };
  if (isExpired(str(quote.expiry_date))) {
    return { ok: false, reason: 'This proposal has expired. Contact us and we will prepare an updated one.' };
  }
  return { ok: true };
}

/* ==========================================================================
 * MARGIN — INFORMATIONAL ONLY. ENFORCEMENT LIVES ELSEWHERE.
 * ==========================================================================
 * ENFORCEMENT is `lib/quote-margin-guard.ts`, which already existed and is
 * the better mechanism for it: it blocks on `product_pricing.min_selling_price`
 * where a founder has marked that row Approved — a real approved figure per
 * product, not a percentage somebody guessed.
 *
 * This function does NOT enforce anything and must never be wired to a block.
 * Two competing margin systems would eventually disagree, and the one that
 * disagreed quietly would be the one shipping a bad discount.
 *
 * What it adds is a number for the salesperson to SEE while they work, derived
 * from quote_items.unit_cost where that is populated. BUXENA holds verified
 * dealer cost for only three models, so it will usually report "unknown" — and
 * that is the point:
 *
 *   ok       — real cost, above the given floor
 *   unknown  — cost or floor missing, so no claim is made either way
 *   breach   — real cost, below the given floor
 *
 * "unknown" must never be presented as "fine". A salesperson discounting
 * against a margin nobody can compute should be told exactly that.
 * ========================================================================== */

export interface MarginVerdict {
  state: 'ok' | 'unknown' | 'breach';
  marginPercent: number | null;
  floorPercent: number | null;
  message: string;
}

export function describeMargin(input: {
  total: number;
  /** Sum of unit_cost × quantity across lines that HAVE a cost. */
  knownCost: number | null;
  /** True when at least one line is missing its cost — margin is incomplete. */
  costIncomplete: boolean;
  floorPercent: number | null;
}): MarginVerdict {
  const { total, knownCost, costIncomplete, floorPercent } = input;

  if (knownCost === null || costIncomplete) {
    return {
      state: 'unknown',
      marginPercent: null,
      floorPercent,
      message: costIncomplete
        ? 'Margin cannot be checked — one or more lines have no verified cost.'
        : 'Margin cannot be checked — no verified cost is recorded for this quote.',
    };
  }
  if (total <= 0) {
    return { state: 'unknown', marginPercent: null, floorPercent, message: 'Margin cannot be checked — no total.' };
  }

  const marginPercent = ((total - knownCost) / total) * 100;

  if (floorPercent === null) {
    return {
      state: 'unknown',
      marginPercent,
      floorPercent: null,
      message: `Gross margin ${marginPercent.toFixed(1)}%. No margin floor is configured, so this is not checked against one.`,
    };
  }
  if (marginPercent < floorPercent) {
    return {
      state: 'breach',
      marginPercent,
      floorPercent,
      message: `Gross margin ${marginPercent.toFixed(1)}% is below the ${floorPercent}% floor.`,
    };
  }
  return {
    state: 'ok',
    marginPercent,
    floorPercent,
    message: `Gross margin ${marginPercent.toFixed(1)}% (floor ${floorPercent}%).`,
  };
}

/** Recompute totals from lines. The server never trusts a posted total. */
export function computeTotals(
  items: { quantity: number; unitPrice: number }[],
  discount: number
): { subtotal: number; discount: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  // A discount cannot exceed the subtotal, and cannot be negative — either
  // would produce a nonsense total, and a negative discount is a price rise
  // dressed up as a concession.
  const safeDiscount = Math.min(Math.max(discount, 0), subtotal);
  return {
    subtotal: round2(subtotal),
    discount: round2(safeDiscount),
    total: round2(subtotal - safeDiscount),
  };
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
