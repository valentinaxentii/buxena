/**
 * FOLLOW-UP EMAIL TEMPLATE — PREPARED, NOT WIRED TO SEND.
 *
 * This module builds a subject + plain-text body for a follow-up to a
 * customer who started something and didn't continue: a pricing request with
 * no next action, a proposal that was never opened, a recommendation viewed
 * but not acted on, or incomplete project details.
 *
 * Server-side only, same posture as lib/enquiry-reply-templates.ts:
 *   - Nothing here sends email. There is no cron, no trigger, no queue.
 *   - Output feeds a copy button and a mailto: link the founder opens
 *     themselves — see the "Follow-up email" panel on the admin enquiry page.
 *   - No price, discount, margin, availability or warranty claim is ever
 *     generated — those come from the actual proposal/quote, never invented
 *     here.
 *   - Every value is a parameter. This file makes no database calls and
 *     infers nothing; the caller supplies only facts it actually holds.
 *
 * ACTIVATING AUTOMATED SENDING IS OUT OF SCOPE FOR THIS FILE. Doing so would
 * need: explicit founder approval, a real trigger definition (what counts as
 * "no next action" and after how long), and a compliance/unsubscribe review.
 * None of that exists yet, so none of it is assumed here.
 */

export type FollowUpTrigger =
  | 'pricing_request_no_action'
  | 'proposal_not_opened'
  | 'recommendation_not_continued'
  | 'project_details_incomplete';

const TRIGGER_COPY: Record<FollowUpTrigger, { subjectHook: string; openingLine: (name: string) => string }> = {
  pricing_request_no_action: {
    subjectHook: 'your BUXENA pricing request',
    openingLine: (name) => `${name}we wanted to follow up on the pricing request you started with BUXENA.`,
  },
  proposal_not_opened: {
    subjectHook: 'your BUXENA proposal',
    openingLine: (name) => `${name}your BUXENA proposal is ready and waiting for you.`,
  },
  recommendation_not_continued: {
    subjectHook: 'your BUXENA recommendation',
    openingLine: (name) => `${name}you looked at a recommendation from us recently — it's still saved for you.`,
  },
  project_details_incomplete: {
    subjectHook: 'finishing your BUXENA project details',
    openingLine: (name) => `${name}your BUXENA project is partway set up — a few details are still open.`,
  },
};

export interface FollowUpRecap {
  modelTitle?: string | null;
  capacity?: string | null;
  primaryDimension?: string | null;
  material?: string | null;
  heaterName?: string | null;
  location?: string | null;
  timeline?: string | null;
}

export interface FollowUpEmailInput {
  trigger: FollowUpTrigger;
  customerFirstName?: string | null;
  recap?: FollowUpRecap;
  /** The real return URL — a proposal link, /my-project/, or /quote/. Never fabricated. */
  primaryCtaHref: string;
  primaryCtaLabel: string;
  siteName: string;
  siteUrl: string;
}

export interface FollowUpEmail {
  trigger: FollowUpTrigger;
  subject: string;
  /** Plain text — matches the mailto:/copy-button pattern used for staff drafts. */
  body: string;
}

const clean = (v: string | null | undefined) => (v ?? '').trim();

function recapLines(recap?: FollowUpRecap): string[] {
  if (!recap) return [];
  const lines: string[] = [];
  if (recap.modelTitle) lines.push(`Model: ${clean(recap.modelTitle).replace(/^BUH-/i, '')}`);
  if (recap.capacity) lines.push(`Capacity: ${recap.capacity}`);
  if (recap.primaryDimension) lines.push(`Dimension: ${recap.primaryDimension}`);
  if (recap.material) lines.push(`Material: ${recap.material}`);
  if (recap.heaterName) lines.push(`Heater: ${recap.heaterName}`);
  if (recap.location) lines.push(`Location: ${recap.location}`);
  if (recap.timeline) lines.push(`Timeline: ${recap.timeline}`);
  return lines;
}

/**
 * Builds the follow-up. Structure, per the brief:
 *   A. BUXENA branding        — siteName in the header line
 *   B. Personalized recap     — recapLines(), omitted entirely if empty
 *   C. Questions we can help answer — restrained, links out, no fake urgency
 *   D. Primary CTA            — back to the real proposal/project URL
 *   E. Secondary links        — Heater Guide, How Buying Works, Compare
 *   F. Testimonials           — deliberately absent; wired only once a real,
 *      approved review exists (see components/Testimonials.astro)
 */
export function buildFollowUpEmail(input: FollowUpEmailInput): FollowUpEmail {
  const firstName = clean(input.customerFirstName);
  const namePrefix = firstName ? `Hi ${firstName}, ` : '';
  const copy = TRIGGER_COPY[input.trigger];

  const subject = `${input.siteName} — ${copy.subjectHook}`;

  const recap = recapLines(input.recap);
  const recapBlock = recap.length ? [`Your project so far:`, ...recap.map((l) => `  ${l}`)].join('\n') : '';

  const questions = [
    'Is this model right for my space? — Sauna Advisor',
    'Which heater actually matches the room? — Heater Guide',
    'What does delivery involve? — How Buying Works',
  ];

  const sections = [
    `${input.siteName}`,
    '',
    copy.openingLine(namePrefix),
    recapBlock,
    'A few questions worth having answered before you decide:',
    questions.map((q) => `  - ${q}`).join('\n'),
    `${input.primaryCtaLabel}: ${input.primaryCtaHref}`,
    [
      'A few more places to look:',
      `  - Heater Guide: ${input.siteUrl}/heater-guide/`,
      `  - How Buying Works: ${input.siteUrl}/how-buying-works/`,
      `  - Compare Saunas: ${input.siteUrl}/compare/`,
    ].join('\n'),
    'Reply to this email any time — a specialist will pick it up directly.',
    ['Warm regards,', 'The BUXENA Team'].join('\n'),
  ].filter(Boolean);

  return { trigger: input.trigger, subject, body: sections.join('\n\n') };
}
