import assert from "node:assert/strict";
import test from "node:test";

import {
  isRevealAlreadyOpen,
  isSubmissionAlreadyRevealed,
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
