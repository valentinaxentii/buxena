/**
 * Customer-safe product documents.
 *
 * Two rules, and the second is the one that matters commercially:
 *
 *  1. The section renders ONLY when this model actually has documents. An
 *     empty "Drawings & Documents" heading advertises a gap rather than the
 *     product, and invites a customer to ask for something that does not exist.
 *
 *  2. An ALLOWLIST decides what may be published, not a blocklist. A blocklist
 *     fails open: the day someone adds "Dealer Price List 2027" to a model's
 *     downloads, a blocklist that never heard of it publishes it. Dealer cost
 *     is the core commercial secret of this business, so anything not
 *     explicitly recognised as customer-safe is withheld.
 *
 * Uploaded commercial files live in the private Supabase bucket and are
 * reachable only through short-lived signed URLs behind admin auth (see
 * lib/document-access.ts). This module governs the separate, public,
 * frontmatter-declared product literature.
 */

export interface ProductDocument {
  label: string;
  /** Public path under /public, or an absolute URL. */
  file?: string;
  note?: string;
}

/**
 * Document kinds a customer may see. Matched against the label, case
 * insensitively. Anything unmatched is withheld — see rule 2.
 */
const CUSTOMER_SAFE = [
  /\bfloor\s*plan\b/i,
  /\bdimension(s)?\s*(drawing)?\b/i,
  /\bdrawing\b/i,
  /\binstallation\s*(manual|guide|instructions)\b/i,
  /\buser\s*(manual|guide)\b/i,
  /\bowner'?s?\s*manual\b/i,
  /\belectrical\s*(guide|spec|specification|requirements)\b/i,
  /\bfoundation\s*(guide|requirements)\b/i,
  /\bheater\s*manual\b/i,
  /\bwarranty\b/i,
  /\bmaintenance\s*(guide)?\b/i,
  /\bspecification\s*sheet\b/i,
  /\bbrochure\b/i,
  /\bpresentation\b/i,
];

/**
 * Never publish, whatever else matches. Redundant against the allowlist by
 * design — two independent reasons to withhold a cost document, because one of
 * them being wrong should not be enough to leak it.
 */
const NEVER_PUBLIC = [
  /\bdealer\b/i,
  /\bcost\b/i,
  /\bexw\b/i,
  /\blanded\b/i,
  /\bmargin\b/i,
  /\bprice\s*list\b/i,
  /\bsupplier\s*(pricing|price)\b/i,
  /\binternal\b/i,
  /\bagreement\b/i,
  /\bcontract\b/i,
  /\binvoice\b/i,
  /\bpurchase\s*order\b/i,
];

export function isCustomerSafeDocument(doc: ProductDocument): boolean {
  const label = (doc.label ?? '').trim();
  if (!label) return false;
  if (NEVER_PUBLIC.some((re) => re.test(label))) return false;
  return CUSTOMER_SAFE.some((re) => re.test(label));
}

/**
 * The documents this model may show publicly.
 *
 * A document with no `file` is a placeholder in the content — the label is
 * recorded but nothing exists to link to — so it is dropped rather than
 * rendered as a dead link.
 */
export function customerSafeDocuments(docs: ProductDocument[] = []): ProductDocument[] {
  return docs.filter((doc) => Boolean(doc.file) && isCustomerSafeDocument(doc));
}

/** Should the product page render a Documents section at all? */
export function hasCustomerDocuments(docs: ProductDocument[] = []): boolean {
  return customerSafeDocuments(docs).length > 0;
}
