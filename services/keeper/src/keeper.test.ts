import { test } from "node:test";
import assert from "node:assert/strict";

import {
  closeRoundV2,
  errorMatches,
  errorName,
  keepRoundV2,
  waitForRound,
} from "./index.js";

test("errorMatches detects idempotent contract error codes in any shape", () => {
  assert.equal(errorMatches(new Error("RevealAlreadyOpen"), ["RevealAlreadyOpen"]), true);
  assert.equal(errorMatches(new Error("HostError: ... AlreadyRevealed(32)"), ["AlreadyRevealed"]), true);
  assert.equal(errorMatches({ message: "HashMismatch" }, ["HashMismatch"]), true);
  assert.equal(errorMatches({ error: { code: "RevealWindowClosed" } }, ["RevealWindowClosed"]), true);
  assert.equal(errorMatches(new Error("InvalidDrandSignature"), ["AlreadyRevealed"]), false);
});

test("errorName extracts a readable message", () => {
  assert.equal(errorName(new Error("boom")), "boom");
  assert.equal(errorName({ message: "x" }), JSON.stringify({ message: "x" }));
});

test("waitForRound returns false for a future round when not allowed to wait", async () => {
  // A stub Drand client whose chain info puts round R far in the future.
  const nowS = Math.floor(Date.now() / 1000);
  const fakeDrand = {
    chain: () => ({
      info: async () => ({ genesis_time: nowS, period: 3 }),
    }),
  } as never;

  const ok = await waitForRound(
    { sdk: {} as never, drand: fakeDrand, maxWaitSeconds: 0 },
    1_000_000, // ~ genesis + 3,000,000s in the future
  );
  assert.equal(ok, false);
});

test("waitForRound returns true immediately for an already-published round", async () => {
  const nowS = Math.floor(Date.now() / 1000);
  const fakeDrand = {
    chain: () => ({
      // genesis far in the past so round 1 is long published.
      info: async () => ({ genesis_time: nowS - 10_000, period: 3 }),
    }),
  } as never;

  const ok = await waitForRound(
    { sdk: {} as never, drand: fakeDrand, maxWaitSeconds: 0 },
    1,
  );
  assert.equal(ok, true);
});

test("keepRoundV2 opens and reveals complete structured payloads", async () => {
  const envelope = {
    amount: 700n,
    nonce: new Uint8Array(32).fill(3),
    payload: new TextEncoder().encode("proposal body"),
  };
  const revealed: Array<{ bidder: string; payload: Uint8Array }> = [];
  const round = {
    status: { tag: "Revealing" },
    reveal_round: 42n,
  };
  const sdk = {
    async getRoundV2() {
      return round;
    },
    async getBiddersV2() {
      return ["GNEW", "GDONE"];
    },
    async getSubmissionV2(_roundId: bigint, bidder: string) {
      return {
        revealed_envelope: bidder === "GDONE" ? Buffer.from([1]) : undefined,
      };
    },
    async getSealV2() {
      return { ciphertext: Buffer.from("sealed"), auditor_blob: Buffer.alloc(0) };
    },
    async revealV2(params: { bidder: string; envelope: typeof envelope }) {
      revealed.push({ bidder: params.bidder, payload: params.envelope.payload });
    },
  };

  const result = await keepRoundV2(
    {
      sdk: sdk as never,
      drand: {} as never,
      openStructuredPayload: async () => envelope,
    },
    7n,
  );

  assert.deepEqual(result.revealed, ["GNEW"]);
  assert.deepEqual(result.skipped, [
    { bidder: "GDONE", reason: "already revealed" },
  ]);
  assert.equal(result.finalStatus, "Revealing");
  assert.equal(new TextDecoder().decode(revealed[0]?.payload), "proposal body");
});

test("closeRoundV2 finalizes ReceiptOnly without calling settlement", async () => {
  let status = "Revealing";
  let settleCalls = 0;
  const sdk = {
    async getRoundV2() {
      return {
        status: { tag: status },
        mode: { tag: "ReceiptOnly" },
        reveal_deadline: 0n,
        winner: undefined,
      };
    },
    async clearV2() {
      status = "Settled";
      return undefined;
    },
    async settleV2() {
      settleCalls += 1;
    },
  };

  const result = await closeRoundV2(
    { sdk: sdk as never, drand: {} as never },
    8n,
  );

  assert.equal(result.cleared, true);
  assert.equal(result.settled, true);
  assert.equal(result.finalStatus, "Settled");
  assert.equal(settleCalls, 0);
});
