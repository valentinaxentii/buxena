/**
 * The customer proposal: what may reach a customer, and what may not.
 * Run with:  npm test
 *
 * The expensive failure here is not a broken page — it is a correct-looking
 * page carrying a number the customer was never meant to see. Dealer cost,
 * unit cost, margin and internal notes live on the same rows as the figures
 * the proposal is built from, so these tests pin the projection itself rather
 * than trusting a template to keep omitting things.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toCustomerProposal,
  describeMargin,
  computeTotals,
  isExpired,
  isAcceptable,
  isValidShareToken,
  generateShareToken,
} from '../src/lib/quote-proposal.ts';

const quoteRow = {
  quote_number: 'Q-TEST1',
  quote_date: '2026-08-13',
  expiry_date: '2099-01-01',
  status: 'Sent',
  subtotal: 10000,
  discount: 500,
  total: 9500,
  customer_notes: 'Bench upgrade included as discussed.',
  // Everything below MUST NOT reach a customer. The values are deliberately
  // odd digit-strings that cannot occur as a substring of a legitimate
  // customer-facing figure — an earlier version used 1000, which is inside
  // the perfectly legitimate subtotal 10000 and failed for the wrong reason.
  internal_notes: 'Margin thin, do not discount further.',
  dealer_cost: 6317,
  margin_percent: 37,
  supplier_note: 'Capra EXW 2240',
};

const itemRows = [
  { kind: 'sauna', description: 'UKU 230', quantity: 1, unit_price: 8000, line_total: 8000, unit_cost: 5419 },
  { kind: 'heater', description: 'Electric heater', quantity: 1, unit_price: 2000, line_total: 2000, unit_cost: 1873 },
];

test('no internal field survives the projection', () => {
  const p = toCustomerProposal(quoteRow, itemRows, { customerName: 'Jane Doe' });
  const serialized = JSON.stringify(p);
  for (const leak of ['internal_notes', 'dealer_cost', 'margin_percent', 'supplier_note', 'unit_cost']) {
    assert.ok(!serialized.includes(leak), `${leak} key must not appear`);
  }
  // The values themselves, not just the key names.
  for (const value of ['6317', '5419', '1873', 'Margin thin', 'Capra EXW']) {
    assert.ok(!serialized.includes(value), `internal value "${value}" must not appear`);
  }
});

test('the customer-visible figures DO survive', () => {
  const p = toCustomerProposal(quoteRow, itemRows, { customerName: 'Jane Doe' });
  assert.equal(p.customerName, 'Jane Doe');
  assert.equal(p.quoteNumber, 'Q-TEST1');
  assert.equal(p.subtotal, 10000);
  assert.equal(p.discount, 500);
  assert.equal(p.total, 9500);
  assert.equal(p.items.length, 2);
  assert.equal(p.customerNotes, 'Bench upgrade included as discussed.');
});

test('a line with an unknown kind is shown, not silently dropped', () => {
  // A customer is being charged for it; hiding it would be worse than
  // filing it under "Other".
  const p = toCustomerProposal(quoteRow, [{ kind: 'wildcard', description: 'Crane hire', quantity: 1, unit_price: 400, line_total: 400 }]);
  assert.equal(p.items.length, 1);
  assert.equal(p.items[0].kind, 'other');
});

test('a nameless line is dropped rather than rendered blank', () => {
  const p = toCustomerProposal(quoteRow, [{ kind: 'sauna', description: '   ', quantity: 1, unit_price: 10, line_total: 10 }]);
  assert.equal(p.items.length, 0);
});

test('delivery and installation say nothing unless explicitly set', () => {
  const unset = toCustomerProposal(quoteRow, itemRows);
  assert.equal(unset.delivery, 'unset');
  assert.equal(unset.installation, 'unset');

  const set = toCustomerProposal({ ...quoteRow, delivery_state: 'included', installation_state: 'tbc' }, itemRows);
  assert.equal(set.delivery, 'included');
  assert.equal(set.installation, 'tbc');

  // A junk value must fall back to silence, never to a promise.
  const junk = toCustomerProposal({ ...quoteRow, delivery_state: 'free!' }, itemRows);
  assert.equal(junk.delivery, 'unset');
});

test('hasPricing is false when there is nothing priced', () => {
  const p = toCustomerProposal(
    { ...quoteRow, subtotal: 0, discount: 0, total: 0 },
    [{ kind: 'sauna', description: 'UKU 230', quantity: 1, unit_price: 0, line_total: 0 }]
  );
  assert.equal(p.hasPricing, false);
});

test('expiry is judged by date, and drives acceptability', () => {
  assert.equal(isExpired('2000-01-01'), true);
  assert.equal(isExpired('2099-01-01'), false);
  assert.equal(isExpired(null), false);

  assert.equal(isAcceptable({ status: 'Sent', expiry_date: '2099-01-01' }).ok, true);
  assert.equal(isAcceptable({ status: 'Sent', expiry_date: '2000-01-01' }).ok, false);
  assert.equal(isAcceptable({ status: 'Draft', expiry_date: '2099-01-01' }).ok, false);
  assert.equal(isAcceptable({ status: 'Sent', accepted_at: '2026-08-13' }).ok, false);
  assert.equal(isAcceptable({ status: 'Declined' }).ok, false);
  assert.equal(isAcceptable({ status: 'Converted' }).ok, false);
});

test('share tokens are long, random and shape-checked', () => {
  const a = generateShareToken();
  const b = generateShareToken();
  assert.match(a, /^[0-9a-f]{40}$/);
  assert.notEqual(a, b, 'tokens must not repeat');
  assert.equal(isValidShareToken(a), true);
  for (const bad of ['', '1', 'x'.repeat(40), '../../etc/passwd', null, undefined, 42, a + 'a']) {
    assert.equal(isValidShareToken(bad as unknown), false, `must reject ${String(bad).slice(0, 20)}`);
  }
});

test('totals are recomputed from lines, never trusted from input', () => {
  const t = computeTotals([{ quantity: 2, unitPrice: 100 }, { quantity: 1, unitPrice: 50 }], 25);
  assert.equal(t.subtotal, 250);
  assert.equal(t.discount, 25);
  assert.equal(t.total, 225);
});

test('a discount cannot exceed the subtotal or go negative', () => {
  // Either would produce a nonsense total; a negative discount is a price
  // rise wearing a concession's clothes.
  assert.equal(computeTotals([{ quantity: 1, unitPrice: 100 }], 500).total, 0);
  assert.equal(computeTotals([{ quantity: 1, unitPrice: 100 }], 500).discount, 100);
  assert.equal(computeTotals([{ quantity: 1, unitPrice: 100 }], -50).discount, 0);
});

test('margin display is UNKNOWN when cost is missing — never quietly "fine"', () => {
  const noCost = describeMargin({ total: 1000, knownCost: null, costIncomplete: false, floorPercent: 30 });
  assert.equal(noCost.state, 'unknown');

  const partial = describeMargin({ total: 1000, knownCost: 400, costIncomplete: true, floorPercent: 30 });
  assert.equal(partial.state, 'unknown', 'a partially-costed quote cannot be judged');
});

test('margin is UNKNOWN when no floor is configured, but still reports the figure', () => {
  // BUXENA has not approved a floor. We report the margin and say plainly
  // that it is not being checked, rather than inventing a threshold.
  const v = describeMargin({ total: 1000, knownCost: 600, costIncomplete: false, floorPercent: null });
  assert.equal(v.state, 'unknown');
  assert.equal(Math.round(v.marginPercent!), 40);
  assert.match(v.message, /No margin floor is configured/);
});

test('margin breach is detected only against real cost and a real floor', () => {
  const breach = describeMargin({ total: 1000, knownCost: 900, costIncomplete: false, floorPercent: 30 });
  assert.equal(breach.state, 'breach');
  assert.equal(Math.round(breach.marginPercent!), 10);

  const ok = describeMargin({ total: 1000, knownCost: 500, costIncomplete: false, floorPercent: 30 });
  assert.equal(ok.state, 'ok');
  assert.equal(Math.round(ok.marginPercent!), 50);
});
