/**
 * What an admin query ACTUALLY returned, in the four cases that need four
 * different things said on screen.
 *
 * WHY THIS EXISTS
 * ---------------
 * The admin enquiry pages read `data` and ignored `error`. A database outage,
 * a revoked key or a table that had not been migrated yet therefore looked
 * exactly like an empty database: the list said "No enquiries yet" and the
 * detail page said "Enquiry not found". Both statements are lies a founder
 * would act on — one means "the funnel is quiet", the other means "this record
 * never existed" — while the real situation (nobody can read the CRM right now)
 * was invisible.
 *
 * The distinction that matters, and that a single `error` boolean cannot make:
 *
 *   ok             the query ran. An empty list is a FACT and may be reported.
 *   missing        the query ran and the row genuinely is not there. Only
 *                  PostgREST's "no rows" answer to .single() proves this.
 *   configuration  the site cannot talk to the database at all — missing
 *                  credentials, or a table/column a migration has not created
 *                  yet. Nothing is wrong with the DATA; nothing can be read.
 *   unavailable    anything else: network, permissions, a timeout. Usually
 *                  temporary, so retrying is meaningful.
 *
 * Pure and dependency-free, so the decision table can be tested without a
 * database — the only way these paths ever get exercised at all. Nothing here
 * inspects an error MESSAGE: messages name tables, columns and constraints, and
 * must never reach the UI or a log line.
 */

export type LoadKind = 'ok' | 'missing' | 'configuration' | 'unavailable';

export interface LoadState<T> {
  kind: LoadKind;
  data: T | null;
}

/** PostgREST's answer to `.single()` when the filter matched no row. */
const NO_ROWS = 'PGRST116';

/**
 * Undefined table / undefined column / unknown relation: these mean the code
 * has shipped ahead of a migration — a configuration problem, not a data one.
 */
const CONFIGURATION_CODES = new Set([
  '42P01', // undefined_table
  '42703', // undefined_column
  'PGRST205', // table not found in the schema cache
  'PGRST204', // column not found in the schema cache
]);

const codeOf = (error: unknown): string =>
  typeof (error as { code?: unknown })?.code === 'string' ? String((error as { code: string }).code) : '';

/** Which of the two failure kinds is this? Never 'ok', never 'missing'. */
export function classifyQueryError(error: unknown): 'configuration' | 'unavailable' {
  return CONFIGURATION_CODES.has(codeOf(error)) ? 'configuration' : 'unavailable';
}

/**
 * A single-row read (`.single()` / `.maybeSingle()`).
 * `configured` is the caller's knowledge of whether the client could even be
 * constructed — the one failure that has no error object to inspect.
 */
export function classifyRow<T>(res: { data: T | null; error: unknown }, configured = true): LoadState<T> {
  if (!configured) return { kind: 'configuration', data: null };
  if (res.error) {
    return { kind: codeOf(res.error) === NO_ROWS ? 'missing' : classifyQueryError(res.error), data: null };
  }
  if (res.data == null) return { kind: 'missing', data: null };
  return { kind: 'ok', data: res.data };
}

/** A list read. A list can never be 'missing' — it can only be empty. */
export function classifyList<T>(
  res: { data: T[] | null; error: unknown },
  configured = true
): { kind: Exclude<LoadKind, 'missing'>; rows: T[] } {
  if (!configured) return { kind: 'configuration', rows: [] };
  if (res.error) return { kind: classifyQueryError(res.error), rows: [] };
  return { kind: 'ok', rows: res.data ?? [] };
}

// ---------------------------------------------------------------------------
// Words for each case, in one place so a list and a detail page cannot drift
// into describing the same failure two different ways.
// ---------------------------------------------------------------------------

export const CONFIGURATION_HEADLINE = 'Not connected to Supabase yet';
export const CONFIGURATION_BODY =
  'The admin cannot reach the database. See README-ADMIN.md to connect a project and run the schema.';

export const LOAD_FAILED_HEADLINE = 'Could not load enquiries';
export const LOAD_FAILED_BODY =
  'This is a loading error, not an empty inbox — there may be unanswered enquiries waiting. Nothing was changed. Try again in a moment.';

export const RECORD_FAILED_HEADLINE = 'Could not load this enquiry';
export const RECORD_FAILED_BODY =
  'This is a loading error, not a missing record — the enquiry was not deleted and nothing was changed. Try again in a moment.';

export const RETRY_LABEL = 'Try again';

/**
 * The action was submitted, but the page could not re-read the record to prove
 * what happened. Saying "created" would be a guess and saying "failed" could be
 * false; this says exactly what is known.
 */
export const UNCONFIRMED_ACTION_MESSAGE =
  'The action was submitted, but this page could not reload the enquiry to confirm it. Reload and check the record before repeating anything.';

// ---------------------------------------------------------------------------
// Reading answers OUT of a record that has already been captured
// ---------------------------------------------------------------------------

/**
 * One parsed answer by label, or null when the customer did not give one.
 * Returning null is the point: the UI must show "—" rather than borrow another
 * field's value (the ZIP row used to display the placement answer).
 */
export function findAnswer(fields: { label: string; value: string }[], label: RegExp): string | null {
  const hit = fields.find((f) => label.test(f.label.trim()));
  return hit && hit.value ? hit.value : null;
}

export interface CampaignFact {
  label: string;
  value: string;
}

/**
 * The PERMITTED campaign facts, recovered from the arrival entry this capture
 * already writes into the activity timeline (`Enquiry received — <source> |
 * landing page: … · utm source: …`). No new storage, no new column: the same
 * record, made readable at a glance instead of only as a paragraph.
 *
 * An allow-list on purpose. The timeline description is free text, so anything
 * that is not one of these labels is ignored rather than echoed into a panel a
 * founder reads as fact.
 */
const CAMPAIGN_LABELS: Record<string, string> = {
  'landing page': 'Landing page',
  referrer: 'Referrer',
  'utm source': 'UTM source',
  'utm medium': 'UTM medium',
  'utm campaign': 'UTM campaign',
  'utm content': 'UTM content',
  'utm term': 'UTM term',
};

export function campaignFacts(descriptions: (string | null | undefined)[]): CampaignFact[] {
  for (const raw of descriptions) {
    const text = String(raw ?? '');
    if (!text.startsWith('Enquiry received —') || !text.includes(' | ')) continue;
    const facts: CampaignFact[] = [];
    for (const part of text.split(' | ').slice(1).join(' | ').split(' · ')) {
      const at = part.indexOf(':');
      if (at === -1) continue;
      const key = part.slice(0, at).trim().toLowerCase();
      const value = part.slice(at + 1).trim();
      const label = CAMPAIGN_LABELS[key];
      if (label && value) facts.push({ label, value });
    }
    return facts;
  }
  return [];
}

/** Shown in place of ONE optional panel that failed, never instead of the record. */
export function sectionUnavailable(section: string): string {
  return `The ${section} could not be loaded just now, so this section may be incomplete. Reload the page to try again — the rest of this enquiry is unaffected.`;
}

// ---------------------------------------------------------------------------
// Permanent deletion of an enquiry
// ---------------------------------------------------------------------------

export type DeletionDecision = 'allowed' | 'blocked-linked' | 'blocked-unverified';

/**
 * A converted enquiry is the source record behind a Lead or Quote and must
 * survive it. The dangerous case is not a linked enquiry — that is refused with
 * a clear reason — it is an UNVERIFIABLE one: if the linkage lookup errored we
 * do not know, and an irreversible delete must then be refused rather than
 * allowed by default.
 */
export function decideEnquiryDeletion(
  res: { data: { lead_id?: string | null; quote_id?: string | null } | null; error: unknown },
  configured = true
): DeletionDecision {
  if (!configured) return 'blocked-unverified';
  if (res.error) return 'blocked-unverified';
  if (!res.data) return 'blocked-unverified';
  return res.data.lead_id || res.data.quote_id ? 'blocked-linked' : 'allowed';
}

export const DELETION_MESSAGES: Record<Exclude<DeletionDecision, 'allowed'>, string> = {
  'blocked-linked':
    'This enquiry is linked to a Lead or Quote and cannot be deleted — it must remain as the source record. Archive it, or set its status to Lost, to close it instead.',
  'blocked-unverified':
    'Could not verify whether this enquiry is linked to a Lead or Quote, so deletion is blocked rather than guessed at. Reload the page and try again; if it keeps happening, archive the enquiry instead.',
};

// ---------------------------------------------------------------------------
// Did the action the founder just asked for actually take effect?
// ---------------------------------------------------------------------------

export interface ActionMessage {
  tone: 'notice' | 'error';
  message: string;
}

/**
 * Every action is confirmed against the record RE-READ from the database, not
 * against the fact that the write call returned. A status change that silently
 * did nothing, or a conversion whose row was rolled back, must never be
 * reported as success.
 */
export function statusChangeConfirmation(
  actualStatus: string | null | undefined,
  requestedStatus: string
): ActionMessage {
  return actualStatus === requestedStatus
    ? { tone: 'notice', message: `Status updated to ${requestedStatus}.` }
    : {
        tone: 'error',
        message: `The status change to ${requestedStatus} did not take effect — the record still reads "${
          actualStatus ?? 'unknown'
        }". Nothing was changed. Reload and try again.`,
      };
}

export function contactedConfirmation(contactedAt: string | null | undefined): ActionMessage {
  return contactedAt
    ? { tone: 'notice', message: 'Marked as contacted.' }
    : {
        tone: 'error',
        message: 'The enquiry was not marked as contacted — nothing was changed. Reload and try again.',
      };
}

/** Confirmed from the re-read row, so a rolled-back conversion cannot read as success. */
export function conversionConfirmation(kind: 'lead' | 'quote', linkedId: string | null | undefined): ActionMessage {
  const noun = kind === 'lead' ? 'Lead' : 'Quote';
  return linkedId
    ? { tone: 'notice', message: `${noun} created and linked to this enquiry.` }
    : {
        tone: 'error',
        message: `The ${noun.toLowerCase()} was not created — nothing was linked and nothing was changed. Reload and try again.`,
      };
}

export const ALREADY_CONVERTED_MESSAGES: Record<'lead' | 'quote', string> = {
  lead: 'This enquiry was already converted to a Lead — no second Lead was created.',
  quote: 'A Quote already exists for this enquiry — no second Quote was created.',
};

/**
 * A conversion that reported failure. The reason is a CODE from
 * lib/enquiry-conversion.ts, never a database message, and each code maps to a
 * sentence a founder can act on. An unrecognised code falls back to a generic
 * sentence rather than leaking the code into the UI.
 */
export function conversionFailureMessage(kind: 'lead' | 'quote', reason: string): string {
  const noun = kind === 'lead' ? 'Lead' : 'Quote';
  switch (reason) {
    case 'NOT_FOUND':
      return 'That enquiry no longer exists, so nothing was converted. Reload the enquiries list.';
    case 'QUOTE_CREATE_FAILED':
      return 'The quote could not be saved and nothing was linked. Nothing was changed — please try again.';
    default:
      return `Could not create the ${noun} — nothing was changed. Please try again.`;
  }
}

