import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalSendReadiness, statusAfterProposalSent } from '../src/lib/proposal-workflow.ts';
import { buildProposalEmail, buildProposalAcceptedCustomerEmail, buildProposalAcceptedStaffEmail } from '../src/lib/proposal-email.ts';

const ready = { status: 'Ready', customerId: 'customer-1', customerEmail: 'customer@example.com', productId: 'product-1', itemCount: 3, subtotal: 18_000, total: 19_143, expiryDate: '2099-12-31' };

test('a complete proposal is ready to send', () => assert.deepEqual(proposalSendReadiness(ready), { ok: true }));

test('proposal sending fails closed on every sales-critical gap', () => {
  const cases = [
    [{ customerId: null }, /customer/i], [{ customerEmail: 'not-an-email' }, /email/i],
    [{ productId: null }, /model/i], [{ itemCount: 0 }, /line item/i],
    [{ subtotal: 0 }, /positive subtotal/i], [{ total: 0 }, /positive subtotal/i],
    [{ expiryDate: null }, /expiry/i], [{ expiryDate: '2000-01-01' }, /expired/i],
    [{ status: 'Accepted' }, /accepted quote/i],
  ] as const;
  for (const [change, expected] of cases) {
    const result = proposalSendReadiness({ ...ready, ...change });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? '', expected);
  }
});

test('sending releases Draft/Ready without downgrading later states', () => {
  assert.equal(statusAfterProposalSent('Draft'), 'Sent');
  assert.equal(statusAfterProposalSent('Ready'), 'Sent');
  assert.equal(statusAfterProposalSent('Viewed'), 'Viewed');
  assert.equal(statusAfterProposalSent('Negotiating'), 'Negotiating');
});

const emailInput = { customerName: 'Jane Doe', customerEmail: 'jane@example.com', proposalUrl: 'https://buxena.com/proposal/abc123', quoteNumber: 'BUX-Q-1048', modelName: 'BUX EDA 235', expiryDate: '2099-12-31', advisorName: 'Valentin Axentii', total: 23_279.90 };

test('proposal email contains the decision-critical facts and a real link', () => {
  const email = buildProposalEmail(emailInput);
  assert.ok(email);
  assert.equal(email.to, 'jane@example.com');
  assert.match(email.subject, /BUX EDA 235/);
  for (const value of ['BUX-Q-1048', '$23,279.90', emailInput.proposalUrl, 'Valentin Axentii']) assert.ok(email.text.includes(value));
});

test('proposal emails reject an invalid customer address', () => {
  assert.equal(buildProposalEmail({ ...emailInput, customerEmail: 'wrong' }), null);
  assert.equal(buildProposalAcceptedCustomerEmail({ ...emailInput, customerEmail: '', acceptedName: 'Jane' }), null);
});

test('acceptance emails separate customer confirmation from staff action', () => {
  const customer = buildProposalAcceptedCustomerEmail({ ...emailInput, acceptedName: 'Jane Doe' });
  const staff = buildProposalAcceptedStaffEmail({ ...emailInput, acceptedName: 'Jane Doe', adminUrl: 'https://buxena.com/admin/quotes/quote-1' }, 'sales@buxena.com');
  assert.ok(customer && staff);
  assert.match(customer.text, /Nothing has been charged/);
  assert.doesNotMatch(customer.text, /admin\/quotes/);
  assert.match(staff.text, /Open the quote in BUXENA Admin/);
  assert.equal(staff.replyTo, 'jane@example.com');
});

test('no internal commercial data can be smuggled through proposal email inputs', () => {
  const email = buildProposalEmail(emailInput)!;
  const serialized = `${email.subject}\n${email.text}\n${email.html}`;
  for (const forbidden of ['unit_cost', 'internal_notes', 'margin floor', 'dealer cost']) assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'));
});
