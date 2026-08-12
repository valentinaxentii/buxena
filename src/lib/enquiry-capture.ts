/**
 * The rule that decides what happens to a submitted enquiry.
 *
 * Pulled out of /api/enquiries as a pure function for one reason: this is the
 * most expensive thing in the codebase to get wrong. Every sale starts as one
 * of these submissions, and the failure is silent — a lost lead does not error,
 * it just never arrives. A regression here is invisible until revenue is
 * already gone, so the rule is stated once, in one place, and tested.
 *
 * Two independent capture paths, either of which is enough:
 *   - the database row (the system of record)
 *   - a delivered staff notification (a human who can act on it)
 *
 * Two rules follow from that:
 *   1. Never tell a visitor to try again when somebody already has their
 *      details. It causes duplicate submissions, or an abandoned buyer who
 *      thinks the form is broken.
 *   2. Never send the customer acknowledgment unless the lead really was
 *      captured. It promises a human will follow up; if nobody has it, that
 *      promise is false and worse than silence.
 */

/** What actually happened to each of the three delivery attempts. */
export interface EnquiryOutcome {
  /** The enquiries row was written. */
  recorded: boolean;
  /** Zoho accepted the staff email. NOT "the call didn't throw". */
  emailDelivered: boolean;
  /** Telegram accepted the staff message. NOT "the call didn't throw". */
  telegramDelivered: boolean;
}

export interface EnquiryDecision {
  /** Somebody or something has this lead. */
  captured: boolean;
  /** The staff notifications are the only copy — they must say so. */
  unrecorded: boolean;
  /** Safe to promise the customer a follow-up. */
  shouldAcknowledge: boolean;
  /** 200 when captured; 500 only when the lead is genuinely lost. */
  status: 200 | 500;
}

export function decideEnquiryOutcome(outcome: EnquiryOutcome): EnquiryDecision {
  const reachedAHuman = outcome.emailDelivered || outcome.telegramDelivered;
  const captured = outcome.recorded || reachedAHuman;

  return {
    captured,
    unrecorded: !outcome.recorded,
    shouldAcknowledge: captured,
    status: captured ? 200 : 500,
  };
}

/**
 * Read a delivery boolean out of a settled promise.
 *
 * Both senders resolve normally when they are simply not configured, so
 * "fulfilled" is not evidence that anyone received anything — only the
 * explicit `true` is. This helper exists so that distinction cannot be
 * forgotten at a call site.
 */
export function wasDelivered(result: PromiseSettledResult<boolean | unknown>): boolean {
  return result.status === 'fulfilled' && result.value === true;
}
