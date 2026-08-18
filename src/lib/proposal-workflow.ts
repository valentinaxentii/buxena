import { isExpired } from './quote-proposal.ts';

export interface ProposalSendCandidate {
  status?: unknown;
  customerId?: unknown;
  customerEmail?: unknown;
  productId?: unknown;
  itemCount?: unknown;
  subtotal?: unknown;
  total?: unknown;
  expiryDate?: unknown;
}

export interface ProposalSendReadiness {
  ok: boolean;
  reason?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const terminalStatuses = new Set(['Accepted', 'Declined', 'Expired', 'Converted']);

/** Server-side release gate for a customer proposal email. */
export function proposalSendReadiness(candidate: ProposalSendCandidate): ProposalSendReadiness {
  const status = String(candidate.status ?? 'Draft');
  if (terminalStatuses.has(status)) {
    return { ok: false, reason: `A ${status.toLowerCase()} quote cannot be sent.` };
  }
  if (!String(candidate.customerId ?? '').trim()) {
    return { ok: false, reason: 'Select a customer before sending the proposal.' };
  }
  const email = String(candidate.customerEmail ?? '').trim();
  if (!emailPattern.test(email)) {
    return { ok: false, reason: 'Add a valid customer email address before sending the proposal.' };
  }
  if (!String(candidate.productId ?? '').trim()) {
    return { ok: false, reason: 'Select a sauna model before sending the proposal.' };
  }
  if (Number(candidate.itemCount ?? 0) < 1) {
    return { ok: false, reason: 'Add at least one priced line item before sending the proposal.' };
  }
  if (Number(candidate.subtotal ?? 0) <= 0 || Number(candidate.total ?? 0) <= 0) {
    return { ok: false, reason: 'The proposal must have a positive subtotal and total before it can be sent.' };
  }
  const expiryDate = String(candidate.expiryDate ?? '').trim();
  if (!expiryDate) {
    return { ok: false, reason: 'Set an expiry date before sending the proposal.' };
  }
  if (isExpired(expiryDate)) {
    return { ok: false, reason: 'Update the expired proposal before sending it.' };
  }
  return { ok: true };
}

/** Sending a Draft/Ready quote releases it; resending never loses later state. */
export function statusAfterProposalSent(status: unknown): string {
  const current = String(status ?? 'Draft');
  return current === 'Draft' || current === 'Ready' ? 'Sent' : current;
}
