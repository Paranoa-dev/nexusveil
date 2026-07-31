import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ASSET_AUCTION_SCHEMA_REF,
  SEALED_PROPOSAL_SCHEMA_REF,
  assetAuctionRound,
  decodeSealedProposal,
  encodeSealedProposal,
  sealedProposalRound,
} from "./templates.js";

const shared = {
  itemRef: new Uint8Array(32).fill(1),
  revealRound: 42,
  commitDeadline: 1_000,
  revealDeadline: 2_000,
  auditorPubkey: new Uint8Array(96),
};

describe("Core v2 partner templates", () => {
  it("builds an atomic asset auction with the reviewed defaults", () => {
    const round = assetAuctionRound({
      ...shared,
      paymentAsset: "CPAYMENT",
      lotAsset: "CLOT",
      lotAmount: 1n,
      fixedEscrow: 1_000n,
    });

    assert.equal(round.mode, "Auction");
    assert.equal(round.clearingRule, "HighestBid");
    assert.equal(round.paymentAsset, "CPAYMENT");
    assert.equal(round.lotAsset, "CLOT");
    assert.equal(round.lotAmount, 1n);
    assert.equal(round.fixedEscrow, 1_000n);
    assert.deepEqual(round.schemaRef, ASSET_AUCTION_SCHEMA_REF);
    assert.equal(round.schemaRef.length, 32);
  });

  it("builds a receipt-only proposal round without settlement assets", () => {
    const round = sealedProposalRound(shared);

    assert.equal(round.mode, "ReceiptOnly");
    assert.equal(round.clearingRule, "LowestBid");
    assert.equal(round.paymentAsset, undefined);
    assert.equal(round.lotAsset, undefined);
    assert.equal(round.lotAmount, undefined);
    assert.equal(round.fixedEscrow, 0n);
    assert.deepEqual(round.schemaRef, SEALED_PROPOSAL_SCHEMA_REF);
    assert.equal(round.schemaRef.length, 32);
  });

  it("encodes proposal metadata deterministically and round-trips", () => {
    const left = encodeSealedProposal({
      timelineDays: 14,
      approach: "formal review",
      metadata: { region: "EU", team: "3" },
    });
    const right = encodeSealedProposal({
      timelineDays: 14,
      approach: "formal review",
      metadata: { team: "3", region: "EU" },
    });

    assert.deepEqual(left, right);
    assert.deepEqual(decodeSealedProposal(left), {
      timelineDays: 14,
      approach: "formal review",
      metadata: { region: "EU", team: "3" },
    });
  });

  it("rejects invalid proposal fields", () => {
    assert.throws(
      () => encodeSealedProposal({ timelineDays: 0, approach: "valid" }),
      /timelineDays/,
    );
    assert.throws(
      () => encodeSealedProposal({ timelineDays: 1, approach: " " }),
      /approach/,
    );
    assert.throws(
      () => decodeSealedProposal(new TextEncoder().encode('{"version":2}')),
      /unsupported proposal version/,
    );
  });
});
