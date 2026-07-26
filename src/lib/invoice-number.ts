import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Invoice / proforma numbering — Stage 1.
 *
 * The actual assignment lives in Postgres (`issue_document_number(uuid)` in
 * supabase/schema.sql), NOT here. That is deliberate: gapless numbering needs
 * a row-level lock (SELECT ... FOR UPDATE) inside a transaction, and the
 * Supabase JS client (PostgREST) cannot express transactions — a plpgsql
 * function body is atomic, so a failed issue rolls back its counter increment
 * and consumes no number.
 *
 * This module is the thin server-side wrapper plus the pure formatting logic
 * (kept in sync with the SQL and unit-testable without a database).
 */

export type DocumentType = 'invoice' | 'proforma';
export type DocumentScope = 'INV' | 'PRO';

export function documentScopeFor(documentType: DocumentType): DocumentScope {
  return documentType === 'proforma' ? 'PRO' : 'INV';
}

/**
 * INV-YYYY-NNNN / PRO-YYYY-NNNN. The counter is zero-padded to 4 digits but
 * grows naturally past 9999 — numbers are never truncated or wrapped.
 */
export function formatDocumentNumber(scope: DocumentScope, year: number, n: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`formatDocumentNumber: year must be a 4-digit integer, got ${year}`);
  }
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`formatDocumentNumber: counter must be a positive integer, got ${n}`);
  }
  return `${scope}-${year}-${String(n).padStart(4, '0')}`;
}

/**
 * The calendar year a document's sequence belongs to: the invoice's own
 * issue_date when set, else today. Matches the SQL exactly.
 */
export function sequenceYearFor(issueDate: string | null | undefined, today = new Date()): number {
  if (issueDate) {
    const y = Number(issueDate.slice(0, 4));
    if (Number.isInteger(y) && y >= 1000) return y;
  }
  return today.getFullYear();
}

/**
 * Assigns the next gapless number to an unnumbered draft and moves it to
 * 'issued', atomically. Throws if the invoice is missing, already numbered,
 * or not a draft. Returns the assigned number (e.g. "INV-2026-0001").
 */
export async function issueInvoiceNumber(supabase: SupabaseClient, invoiceId: string): Promise<string> {
  const { data, error } = await supabase.rpc('issue_document_number', { p_invoice_id: invoiceId });
  if (error) throw new Error(`issue_document_number failed: ${error.message}`);
  if (typeof data !== 'string' || !data) {
    throw new Error('issue_document_number returned no number');
  }
  return data;
}
