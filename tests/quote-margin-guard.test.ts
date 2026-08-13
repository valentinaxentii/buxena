import test from 'node:test';
import assert from 'node:assert/strict';
import { belowApprovedFloor, quoteNetBeforeTax } from '../src/lib/quote-margin-guard.ts';

test('quote net includes explicitly quoted delivery and installation, less discount', () => {
  assert.equal(quoteNetBeforeTax(10_000, 500, 1_000, 750), 10_750);
});

test('an approved floor blocks only a quote below it', () => {
  assert.equal(belowApprovedFloor(9_999, 10_000), true);
  assert.equal(belowApprovedFloor(10_000, 10_000), false);
});

test('a negative discount is distinguishable from a legitimate floor check', () => {
  assert.equal(quoteNetBeforeTax(10_000, 0, 0, -100), 10_100);
  // Input validation rejects a negative discount before this value is used.
  assert.equal(belowApprovedFloor(10_100, 10_000), false);
});

test('missing or invalid floor never fabricates a commercial rule', () => {
  assert.equal(belowApprovedFloor(1, null), false);
  assert.equal(belowApprovedFloor(1, undefined), false);
  assert.equal(belowApprovedFloor(1, Number.NaN), false);
});
