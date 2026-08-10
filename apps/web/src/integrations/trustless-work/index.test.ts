import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "buffer";
import { StrKey } from "@stellar/stellar-sdk";

import {
  readContractId,
  trustlessWorkConfigIssues,
  validateTrustlessWorkDeployPayload,
} from "./index.js";

function account(seed: number): string {
  return StrKey.encodeEd25519PublicKey(Buffer.alloc(32, seed));
}

test("validates a multi-release Trustless Work payload with milestone receivers", () => {
  const payload = validateTrustlessWorkDeployPayload({
    signer: account(1),
    engagementId: "sub-rosa-round-7",
    title: "Build a Stellar merchant analytics dashboard",
    description: "ReceiptOnly proposal handoff",
    roles: {
      approvers: [account(2)],
      serviceProviders: [account(3)],
      platform: account(4),
      releaseSigners: [account(5)],
      disputeResolvers: [account(6)],
      admin: account(7),
      observers: [account(8)],
    },
    platformFee: 2,
    milestones: [
      {
        description: "Dashboard UI",
        amount: 400,
        receiver: account(9),
      },
      {
        description: "Security review",
        amount: 200,
        receiver: account(10),
      },
    ],
    trustline: {
      symbol: "USDC",
      address: account(11),
    },
  });

  assert.equal(payload.engagementId, "sub-rosa-round-7");
  assert.equal(payload.milestones?.[0]?.receiver, account(9));
  assert.equal(payload.milestones?.[1]?.receiver, account(10));
});

test("rejects invalid Trustless Work role and trustline inputs", () => {
  assert.throws(
    () =>
      validateTrustlessWorkDeployPayload({
        signer: account(1),
        engagementId: "sub-rosa-round-7",
        title: "Build",
        description: "Handoff",
        roles: {
          approvers: [account(2)],
          serviceProviders: [account(3)],
          platform: account(4),
          releaseSigners: [account(5)],
          disputeResolvers: [account(6)],
          admin: account(4),
        },
        platformFee: 0,
        milestones: [
          {
            description: "Milestone",
            amount: 1,
            receiver: account(7),
          },
        ],
        trustline: {
          symbol: "USDC",
          address: account(8),
        },
      }),
    /distinct/,
  );

  assert.throws(
    () =>
      validateTrustlessWorkDeployPayload({
        signer: account(1),
        engagementId: "sub-rosa-round-7",
        title: "Build",
        description: "Handoff",
        roles: {
          approvers: [account(2)],
          serviceProviders: [account(3)],
          platform: account(4),
          releaseSigners: [account(5)],
          disputeResolvers: [account(6)],
          admin: account(7),
        },
        platformFee: 0,
        milestones: [
          {
            description: "Milestone",
            amount: 1,
            receiver: account(8),
          },
        ],
        trustline: {
          symbol: "USDC",
        },
      }),
    /trustline/,
  );
});

test("reports missing Trustless Work config without guessing values", () => {
  assert.deepEqual(
    trustlessWorkConfigIssues({}),
    ["VITE_TRUSTLESS_WORK_API_KEY is missing."],
  );
  assert.equal(readContractId({ contractId: "C123" }), "C123");
});
