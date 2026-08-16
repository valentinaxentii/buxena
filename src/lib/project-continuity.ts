/**
 * "Continue your project" — client-side only, by design.
 *
 * BUXENA is consultation/quote-led with no customer account system (see
 * my-project.astro). Everything this module reads is a browser's own
 * localStorage, already written by existing features:
 *
 *   buxena-plan-your-sauna    — Sauna Advisor shortlist (plan-your-sauna.astro)
 *   buxena-project-readiness  — My Project readiness answers (my-project.astro)
 *   buxena-last-proposal      — last proposal token visited (proposal/[token].astro)
 *
 * This module invents no new tracking and stores no new PII: the proposal
 * record it writes carries only a token, a quote number and a model name —
 * never a price, a name, an address or anything else personal.
 */

export interface ContinuityState {
  kind: 'proposal' | 'project-incomplete' | 'model-selected' | 'none';
  label: string;
  href: string;
  detail?: string;
}

interface LastProposal {
  token: string;
  quoteNumber?: string;
  modelName?: string;
  savedAt: string;
}

const ADVISOR_KEY = 'buxena-plan-your-sauna';
const READINESS_KEY = 'buxena-project-readiness';
export const LAST_PROPOSAL_KEY = 'buxena-last-proposal';

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Called by the proposal page itself on a successful, valid view. */
export function saveLastProposal(entry: Omit<LastProposal, 'savedAt'>): void {
  try {
    const value: LastProposal = { ...entry, savedAt: new Date().toISOString() };
    localStorage.setItem(LAST_PROPOSAL_KEY, JSON.stringify(value));
  } catch {
    /* private browsing / storage unavailable — not worth surfacing */
  }
}

/**
 * Highest-priority known state, in the order a customer would actually care
 * about it: a real proposal outranks a saved shortlist, which outranks
 * nothing at all.
 */
export function getContinuityState(): ContinuityState {
  if (typeof window === 'undefined') return { kind: 'none', label: '', href: '/' };

  const proposal = readJSON<LastProposal>(LAST_PROPOSAL_KEY);
  if (proposal?.token) {
    return {
      kind: 'proposal',
      label: 'Review Your Quote',
      href: `/proposal/${proposal.token}/`,
      detail: proposal.modelName ? `Your ${proposal.quoteNumber ?? 'proposal'} — ${proposal.modelName}` : proposal.quoteNumber,
    };
  }

  const readiness = readJSON<Record<string, string>>(READINESS_KEY);
  const readinessEntries = readiness ? Object.values(readiness) : [];
  const readinessStarted = readinessEntries.some((v) => v && v !== 'not-provided');
  const readinessComplete = readinessEntries.length > 0 && readinessEntries.every((v) => v === 'ready');

  const advisor = readJSON<{ recommended?: string[] }>(ADVISOR_KEY);
  const hasShortlist = Boolean(advisor?.recommended?.length);

  if (readinessStarted && !readinessComplete) {
    return { kind: 'project-incomplete', label: 'Complete Your Project Details', href: '/my-project/' };
  }

  if (hasShortlist) {
    return { kind: 'model-selected', label: 'View Your Recommendation', href: '/my-project/' };
  }

  if (readinessStarted) {
    return { kind: 'project-incomplete', label: 'Continue Your Project', href: '/my-project/' };
  }

  return { kind: 'none', label: '', href: '/my-project/' };
}
