import assert from "node:assert/strict";
import test from "node:test";

import {
  isRevealAlreadyOpen,
  isRevealStillOpen,
  isSubmissionAlreadyRevealed,
  isTxBadSeqError,
} from "./pilotConcurrency.js";

test("recognizes an already-open reveal race by contract code or name", () => {
  assert.equal(
    isRevealAlreadyOpen(new Error("HostError: Error(Contract, #14)")),
    true,
  );
  assert.equal(isRevealAlreadyOpen(new Error("RevealAlreadyOpen")), true);
  assert.equal(isRevealAlreadyOpen(new Error("Contract, #15")), false);
});

test("recognizes a submission revealed concurrently", () => {
  assert.equal(
    isSubmissionAlreadyRevealed(new Error("HostError: Error(Contract, #32)")),
    true,
  );
  assert.equal(isSubmissionAlreadyRevealed(new Error("AlreadyRevealed")), true);
  assert.equal(isSubmissionAlreadyRevealed(new Error("HashMismatch")), false);
});

test("recognizes clear attempts made while the reveal window is still open", () => {
  assert.equal(
    isRevealStillOpen(new Error("HostError: Error(Contract, #16)")),
    true,
  );
  assert.equal(isRevealStillOpen(new Error("RevealStillOpen")), true);
  assert.equal(isRevealStillOpen(new Error("AlreadyCleared")), false);
});

test("recognizes Stellar bad-sequence responses without hiding other errors", () => {
  assert.equal(
    isTxBadSeqError(
      new Error(
        'Sending failed {"result":{"_switch":{"name":"txBadSeq","value":-5}}}',
      ),
    ),
    true,
  );
  assert.equal(
    isTxBadSeqError({
      message: 'Sending failed {"result":{"_switch":{"value": -5}}}',
    }),
    true,
  );
  assert.equal(isTxBadSeqError(new Error("Contract, #32")), false);
});
