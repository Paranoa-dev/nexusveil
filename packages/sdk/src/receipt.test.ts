// Settlement invariant tests for the receipt builder.
//
// These pin down the funds-handling rules independently of the network: for
// every round outcome, the money that leaves the contract for a bidder must
// exactly equal what came in (refund + operator payment == escrow), the winner
// pays exactly their winning bid, and no path ever moves more than the escrow.
// This is the same accounting the on-chain `settle`/`void` paths perform, so a
// mismatch here is a red flag for the contract too.

import { test } from "node:test";
import assert from "node:assert/strict";

import { computeEntrySettlement, type RoundStatusTag } from "./receipt.js";

const NON_TERMINAL: RoundStatusTag[] = ["Open", "Revealing", "Cleared"];

test("winner pays exactly the winning bid, surplus refunded", () => {
  const { paidToOperator, refunded } = computeEntrySettlement({
    status: "Settled",
    escrow: 100n,
    won: true,
    winningBid: 70n,
  });
  assert.equal(paidToOperator, 70n);
  assert.equal(refunded, 30n);
  // Conservation: nothing created or destroyed.
  assert.equal(paidToOperator + refunded, 100n);
});

test("winner with bid equal to escrow gets no refund", () => {
  const { paidToOperator, refunded } = computeEntrySettlement({
    status: "Settled",
    escrow: 50n,
    won: true,
    winningBid: 50n,
  });
  assert.equal(paidToOperator, 50n);
  assert.equal(refunded, 0n);
  assert.equal(paidToOperator + refunded, 50n);
});

test("loser is fully refunded and pays nothing", () => {
  const { paidToOperator, refunded } = computeEntrySettlement({
    status: "Settled",
    escrow: 200n,
    won: false,
    winningBid: 70n,
  });
  assert.equal(paidToOperator, 0n);
  assert.equal(refunded, 200n);
  assert.equal(paidToOperator + refunded, 200n);
});

test("voided round fully refunds every bidder, winner flag ignored", () => {
  for (const won of [true, false]) {
    const { paidToOperator, refunded } = computeEntrySettlement({
      status: "Voided",
      escrow: 123n,
      won,
      winningBid: 0n,
    });
    assert.equal(paidToOperator, 0n);
    assert.equal(refunded, 123n);
  }
});

test("non-terminal statuses move no funds", () => {
  for (const status of NON_TERMINAL) {
    const { paidToOperator, refunded } = computeEntrySettlement({
      status,
      escrow: 999n,
      won: true,
      winningBid: 10n,
    });
    assert.equal(paidToOperator, 0n, `status ${status} paid operator`);
    assert.equal(refunded, 0n, `status ${status} refunded`);
  }
});

test("conservation holds across a fuzzed settled round", () => {
  // Property: for any escrow >= winningBid > 0, a settled entry never leaks or
  // mints value — outflow (operator + refund) equals the escrow inflow, and the
  // operator is never paid more than the escrow.
  for (let i = 0; i < 500; i++) {
    const escrow = BigInt(1 + Math.floor(Math.random() * 1_000_000));
    const winningBid = BigInt(1 + Math.floor(Math.random() * Number(escrow)));
    const won = Math.random() < 0.5;
    const { paidToOperator, refunded } = computeEntrySettlement({
      status: "Settled",
      escrow,
      won,
      winningBid,
    });
    assert.equal(paidToOperator + refunded, escrow, "conservation broke");
    assert.ok(paidToOperator <= escrow, "operator overpaid");
    assert.ok(refunded >= 0n, "negative refund");
    if (won) {
      assert.equal(paidToOperator, winningBid, "winner did not pay their bid");
    } else {
      assert.equal(paidToOperator, 0n, "loser paid operator");
    }
  }
});
