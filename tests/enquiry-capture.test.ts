/**
 * The lead-capture decision table. Run with:  npm test
 *
 * These tests exist because the failure they guard is silent and expensive:
 * a lost enquiry does not raise an error, it simply never arrives, and nobody
 * notices until the revenue is already gone.
 *
 * The original bug: a failed database insert returned 500 immediately, which
 * skipped the staff email and Telegram as well. A Supabase outage therefore
 * destroyed every lead that arrived during it — no row, no notification, no
 * copy anywhere — while the visitor was told to try again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideEnquiryOutcome, wasDelivered } from '../src/lib/enquiry-capture.ts';

test('the normal path: recorded and notified', () => {
  const d = decideEnquiryOutcome({ recorded: true, emailDelivered: true, telegramDelivered: true });
  assert.equal(d.captured, true);
  assert.equal(d.unrecorded, false);
  assert.equal(d.shouldAcknowledge, true);
  assert.equal(d.status, 200);
});

test('database down but email delivered: the lead is still captured', () => {
  const d = decideEnquiryOutcome({ recorded: false, emailDelivered: true, telegramDelivered: false });
  assert.equal(d.captured, true, 'a human has the lead — this is not a failure');
  assert.equal(d.status, 200, 'never ask for a retry when somebody already has the details');
  assert.equal(d.unrecorded, true, 'the notification must say it is the only copy');
  assert.equal(d.shouldAcknowledge, true);
});

test('database down but Telegram delivered: still captured', () => {
  const d = decideEnquiryOutcome({ recorded: false, emailDelivered: false, telegramDelivered: true });
  assert.equal(d.captured, true);
  assert.equal(d.status, 200);
  assert.equal(d.unrecorded, true);
});

test('recorded but both notifications failed: still a success for the visitor', () => {
  const d = decideEnquiryOutcome({ recorded: true, emailDelivered: false, telegramDelivered: false });
  assert.equal(d.captured, true, 'the row is the system of record');
  assert.equal(d.status, 200);
  assert.equal(d.unrecorded, false);
});

test('everything failed: the only case that returns 500', () => {
  const d = decideEnquiryOutcome({ recorded: false, emailDelivered: false, telegramDelivered: false });
  assert.equal(d.captured, false);
  assert.equal(d.status, 500);
  assert.equal(d.shouldAcknowledge, false, 'never promise follow-up nobody can deliver');
});

test('the acknowledgment never goes out when the lead was lost', () => {
  // Exhaustive: the only combination that must not acknowledge is total failure.
  for (const recorded of [true, false]) {
    for (const emailDelivered of [true, false]) {
      for (const telegramDelivered of [true, false]) {
        const d = decideEnquiryOutcome({ recorded, emailDelivered, telegramDelivered });
        const anythingWorked = recorded || emailDelivered || telegramDelivered;
        assert.equal(
          d.shouldAcknowledge,
          anythingWorked,
          `acknowledge should follow capture for ${JSON.stringify({ recorded, emailDelivered, telegramDelivered })}`
        );
      }
    }
  }
});

test('wasDelivered: a fulfilled promise is not proof of delivery', () => {
  // Both senders resolve normally when they are simply not configured. If that
  // counted as delivery, an unconfigured site would report every lost lead as
  // captured — the exact failure these tests exist to prevent.
  assert.equal(wasDelivered({ status: 'fulfilled', value: true }), true);
  assert.equal(wasDelivered({ status: 'fulfilled', value: false }), false);
  assert.equal(wasDelivered({ status: 'fulfilled', value: undefined }), false);
  assert.equal(wasDelivered({ status: 'rejected', reason: new Error('smtp down') }), false);
});
