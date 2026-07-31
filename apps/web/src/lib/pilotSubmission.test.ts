import assert from "node:assert/strict";
import test from "node:test";

import { encodeSealedProposal } from "@sub-rosa/sdk";
import { encodePayloadEnvelope } from "@sub-rosa/tlock";

import { decodePilotSubmission } from "./pilotSubmission.js";

test("decodes a revealed proposal into a partner-readable view", () => {
  const bytes = encodePayloadEnvelope({
    amount: 25_000n,
    nonce: new Uint8Array(32).fill(7),
    payload: encodeSealedProposal({
      timelineDays: 14,
      approach: "Manual review and remediation report",
    }),
  });

  assert.deepEqual(
    decodePilotSubmission("GBIDDER", "ReceiptOnly", bytes, true),
    {
      bidder: "GBIDDER",
      amount: "25000",
      timelineDays: 14,
      approach: "Manual review and remediation report",
      payload: null,
      valid: true,
    },
  );
});

test("decodes a revealed auction amount and optional payload", () => {
  const bytes = encodePayloadEnvelope({
    amount: 99n,
    nonce: new Uint8Array(32).fill(9),
    payload: new TextEncoder().encode("lot terms accepted"),
  });

  assert.deepEqual(decodePilotSubmission("GBIDDER", "Auction", bytes, true), {
    bidder: "GBIDDER",
    amount: "99",
    timelineDays: null,
    approach: null,
    payload: "lot terms accepted",
    valid: true,
  });
});
