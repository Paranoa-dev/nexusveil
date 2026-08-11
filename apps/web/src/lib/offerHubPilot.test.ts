import assert from "node:assert/strict";
import test from "node:test";

import { SEALED_PROPOSAL_SCHEMA_REF, type CoreV2Receipt } from "@sub-rosa/sdk";

import {
  buildOfferHubRoundParams,
  defaultOfferHubJob,
  defaultOfferHubProposalDraft,
  defaultOfferHubWorkspace,
  deriveOfferHubStage,
  offerHubEvidenceSummary,
  offerHubLiveConfigurationIssues,
  offerHubProposalRows,
  offerHubSealInputFromDraft,
  parseOfferHubWorkspace,
  sampleOfferHubProposals,
  selectOfferHubProvider,
  serializeOfferHubWorkspace,
  upsertOfferHubProposal,
} from "./offerHubPilot.js";

function roundParams() {
  return buildOfferHubRoundParams({
    job: defaultOfferHubJob(),
    operator: "GOPERATOR",
    itemRef: new Uint8Array(32).fill(1),
    revealRound: 100,
    commitDeadline: 200,
    revealDeadline: 300,
    auditorPubkey: new Uint8Array(48).fill(2),
  });
}

test("maps an Offer-Hub job through the SDK ReceiptOnly template", () => {
  const params = roundParams();
  assert.equal(params.mode, "ReceiptOnly");
  assert.equal(params.fixedEscrow, 0n);
  assert.equal(params.clearingRule, "LowestBid");
  assert.deepEqual(params.schemaRef, SEALED_PROPOSAL_SCHEMA_REF);
  assert.equal(params.maxParticipants, 25);
});

test("rejects jobs that have not enabled sealed proposals", () => {
  assert.throws(
    () => buildOfferHubRoundParams({
      job: { ...defaultOfferHubJob(), sealedProposalsEnabled: false },
      operator: "GOPERATOR",
      itemRef: new Uint8Array(32).fill(1),
      revealRound: 100,
      commitDeadline: 200,
      revealDeadline: 300,
      auditorPubkey: new Uint8Array(48).fill(2),
    }),
    /sealed proposals must be enabled/,
  );
});

test("validates and maps structured freelancer proposal fields", () => {
  const sealed = offerHubSealInputFromDraft(defaultOfferHubProposalDraft());
  assert.equal(sealed.price, 15_500_000_000n);
  assert.equal(sealed.proposal.timelineDays, 21);
  assert.equal(sealed.proposal.totalAmount, 1550);
  assert.equal(sealed.proposal.currency, "USDC");
  assert.equal(sealed.proposal.metadata?.providerName, "Nova Labs");
  assert.equal(sealed.recordData.relevantExperience.length > 0, true);
});

test("rejects invalid price, timeline, and required proposal content", () => {
  const draft = defaultOfferHubProposalDraft();
  assert.throws(() => offerHubSealInputFromDraft({ ...draft, proposedPrice: "0" }), /positive/);
  assert.throws(() => offerHubSealInputFromDraft({ ...draft, estimatedDeliveryDays: "1.5" }), /whole number/);
  assert.throws(() => offerHubSealInputFromDraft({ ...draft, shortProposal: "" }), /short proposal/);
});

test("keeps proposal content hidden until reveal", () => {
  const proposal = sampleOfferHubProposals(1)[0]!;
  const sealedRows = offerHubProposalRows(proposal, false);
  assert.deepEqual(sealedRows, [
    ["Status", "Sealed"],
    ["Private fields", "Hidden until the shared deadline"],
  ]);
  assert.equal(JSON.stringify(sealedRows).includes(proposal.data.shortProposal), false);
  assert.equal(JSON.stringify(offerHubProposalRows(proposal, true)).includes(proposal.data.shortProposal), true);
});

test("derives application labels without contradicting protocol state", () => {
  const base = {
    roundId: "7",
    deadlineAt: 1_000,
    now: 500,
    proposalCount: 2,
    revealedCount: 0,
    selectedProviderId: null,
  };
  assert.equal(deriveOfferHubStage({ ...base, protocolStatus: "Open" }), "sealed");
  assert.equal(deriveOfferHubStage({ ...base, protocolStatus: "Open", now: 1_001 }), "deadline");
  assert.equal(deriveOfferHubStage({ ...base, protocolStatus: "Revealing" }), "revealing");
  assert.equal(deriveOfferHubStage({ ...base, protocolStatus: "Settled", revealedCount: 2 }), "revealed");
  assert.equal(deriveOfferHubStage({ ...base, protocolStatus: "Settled", revealedCount: 2, selectedProviderId: "p1" }), "selected");
});

test("allows manual selection only after reveal", () => {
  const proposals = sampleOfferHubProposals(1).map((proposal) => ({ ...proposal, revealed: true }));
  assert.throws(() => selectOfferHubProvider(proposals, proposals[0]!.id, "sealed"), /after proposals are revealed/);
  assert.deepEqual(selectOfferHubProvider(proposals, proposals[0]!.id, "revealed"), {
    selectedProviderId: proposals[0]!.id,
    selectedProviderName: proposals[0]!.providerName,
  });
});

test("separates demo evidence from real ReceiptOnly evidence and never invents a winner", () => {
  const demo = offerHubEvidenceSummary({
    mode: "sample",
    proposalCount: 3,
    revealedCount: 3,
    selectedProviderName: "Nova Labs",
    roundId: "fake",
    contractId: "fake",
    receipt: null,
    receiptVerified: null,
  });
  assert.equal(demo.roundId, null);
  assert.equal(demo.contractId, null);
  assert.equal(demo.receiptAvailable, false);

  const receipt = {
    roundId: "9",
    contractId: "CREAL",
    mode: "ReceiptOnly",
    winner: null,
  } as CoreV2Receipt;
  const real = offerHubEvidenceSummary({
    mode: "live",
    proposalCount: 3,
    revealedCount: 3,
    selectedProviderName: "Nova Labs",
    roundId: "9",
    contractId: "CREAL",
    receipt,
    receiptVerified: true,
  });
  assert.equal(real.kind, "real");
  assert.equal(real.selectedProvider, "Nova Labs");
  assert.equal(real.protocolWinner, null);
  assert.equal(real.receiptAvailable, true);
});

test("reports missing live configuration explicitly", () => {
  assert.deepEqual(
    offerHubLiveConfigurationIssues({ contractId: null, walletAddress: null }),
    ["VITE_CONTRACT_ID is not configured.", "Connect a Freighter wallet for signed actions."],
  );
  assert.deepEqual(
    offerHubLiveConfigurationIssues({ contractId: "CCONTRACT", walletAddress: "GWALLET" }),
    [],
  );
});

test("deduplicates repeat submissions from the same provider wallet", () => {
  const initial = sampleOfferHubProposals(1)[0]!;
  const first = { ...initial, id: "live-G1", wallet: "G1", source: "live" as const };
  const replacement = { ...first, data: { ...first.data, proposedPrice: 1400 } };
  const proposals = upsertOfferHubProposal([first], replacement);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]!.data.proposedPrice, 1400);
});

test("persists job, proposals, round, reveal state, and manual selection", () => {
  const workspace = defaultOfferHubWorkspace(1_000);
  workspace.roundId = "17";
  workspace.roundInput = "17";
  workspace.sampleProposals = workspace.sampleProposals.map((proposal) => ({ ...proposal, revealed: true }));
  workspace.selectedProviderId = workspace.sampleProposals[1]!.id;
  workspace.selectedProviderName = workspace.sampleProposals[1]!.providerName;
  const restored = parseOfferHubWorkspace(serializeOfferHubWorkspace(workspace));
  assert.equal(restored.roundId, "17");
  assert.equal(restored.sampleProposals.every((proposal) => proposal.revealed), true);
  assert.equal(restored.selectedProviderName, "StellarCraft");
  assert.equal(restored.job.title, workspace.job.title);
});

test("does not persist plaintext proposal drafts in live mode", () => {
  const workspace = defaultOfferHubWorkspace(1_000);
  workspace.mode = "live";
  workspace.proposalDraft.shortProposal = "private live proposal draft";
  workspace.proposalDraft.relevantExperience = "private experience";
  const serialized = serializeOfferHubWorkspace(workspace);
  const restored = parseOfferHubWorkspace(serialized);
  assert.equal(serialized.includes("private live proposal draft"), false);
  assert.equal(serialized.includes("private experience"), false);
  assert.equal(restored.proposalDraft.shortProposal, "");
});
