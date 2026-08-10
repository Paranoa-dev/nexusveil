import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "buffer";
import { StrKey } from "@stellar/stellar-sdk";

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

test("decodes milestone proposal fields for the Trustless Work handoff", () => {
  const receiver = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 3));
  const bytes = encodePayloadEnvelope({
    amount: 15_000_000_000n,
    nonce: new Uint8Array(32).fill(8),
    payload: encodeSealedProposal({
      timelineDays: 21,
      approach: "Build, integrate, and review",
      totalAmount: 1500,
      currency: "USDC",
      deliverables: ["Dashboard UX", "Stellar data sync"],
      milestones: [
        {
          title: "Dashboard",
          description: "Merchant analytics UI",
          amount: 600,
          receiver,
          delivery: "2026-09-01",
        },
        {
          title: "Integration",
          description: "Ledger data sync",
          amount: 900,
          receiver,
          delivery: "2026-09-10",
        },
      ],
      metadata: {
        provider: "Northstar Studio",
        team: "4 engineers",
      },
    }),
  });

  assert.deepEqual(decodePilotSubmission(receiver, "ReceiptOnly", bytes, true), {
    bidder: receiver,
    amount: "15000000000",
    timelineDays: 21,
    approach: "Build, integrate, and review",
    totalAmount: 1500,
    currency: "USDC",
    deliverables: ["Dashboard UX", "Stellar data sync"],
    milestones: [
      {
        title: "Dashboard",
        description: "Merchant analytics UI",
        amount: 600,
        receiver,
        delivery: "2026-09-01",
      },
      {
        title: "Integration",
        description: "Ledger data sync",
        amount: 900,
        receiver,
        delivery: "2026-09-10",
      },
    ],
    metadata: {
      provider: "Northstar Studio",
      team: "4 engineers",
    },
    payload: null,
    valid: true,
  });
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
