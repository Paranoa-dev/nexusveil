import assert from "node:assert/strict";
import test from "node:test";

import { SEALED_PROPOSAL_SCHEMA_REF } from "@sub-rosa/sdk";

import {
  ACTA_DEFAULT_CREDENTIAL_ID,
  actaProposalFromDraft,
  buildActaRoundParams,
  canSubmitActaProposal,
  defaultActaPilotWorkspace,
  fillEmptyActaProposalDraft,
  hiddenActaProposalRows,
  parseActaPilotWorkspace,
  selectActaProvider,
  serializeActaPilotWorkspace,
} from "./actaPilot.js";

const WALLET = `G${"A".repeat(55)}`;

test("ACTA pilot starts with the live Skill Badge credential preset", () => {
  const workspace = defaultActaPilotWorkspace();
  assert.equal(workspace.policy.credentialType, "SkillBadgeCredential");
  assert.equal(workspace.policy.trustedIssuerDid, "did:stellar:testnet:sd2tszkfg2t7on3clzr3zqlhea");
  assert.equal(workspace.credentialId, ACTA_DEFAULT_CREDENTIAL_ID);
});

test("stored legacy ACTA policy migrates to the pilot preset", () => {
  const workspace = defaultActaPilotWorkspace();
  workspace.policy.credentialType = "VerifiedProviderCredential";
  workspace.credentialId = "";
  const restored = parseActaPilotWorkspace(JSON.stringify(workspace));
  assert.equal(restored.policy.credentialType, "SkillBadgeCredential");
  assert.equal(restored.credentialId, ACTA_DEFAULT_CREDENTIAL_ID);
});

test("successful verification can fill blank proposal fields without replacing user input", () => {
  const filled = fillEmptyActaProposalDraft({
    providerName: "My Studio",
    proposedPrice: "",
    deliveryDays: "  ",
    proposal: "My custom approach",
    experience: "",
  });

  assert.equal(filled.providerName, "My Studio");
  assert.equal(filled.proposal, "My custom approach");
  assert.equal(filled.proposedPrice, "1800");
  assert.equal(filled.deliveryDays, "24");
  assert.match(filled.experience, /Stellar integrations/);
});

test("ACTA pilot maps rounds through the SDK ReceiptOnly template", () => {
  const round = buildActaRoundParams({
    operator: WALLET,
    itemRef: new Uint8Array(32),
    revealRound: 100,
    commitDeadline: 200,
    revealDeadline: 300,
    auditorPubkey: new Uint8Array(48),
  });
  assert.equal(round.mode, "ReceiptOnly");
  assert.equal(round.fixedEscrow, 0n);
  assert.equal(round.schemaRef, SEALED_PROPOSAL_SCHEMA_REF);
});

test("eligible connected owner can proceed and other wallets cannot", () => {
  const eligibility = {
    state: "eligible" as const,
    owner: WALLET,
    credentialId: "credential-1",
    credentialType: "VerifiedProviderCredential",
    issuerDid: `did:stellar:testnet:G${"B".repeat(55)}`,
    subjectDid: `did:stellar:testnet:G${"C".repeat(55)}`,
    status: "valid" as const,
    checkedAt: new Date(0).toISOString(),
    message: "Eligible",
    source: "real" as const,
  };
  assert.equal(canSubmitActaProposal({ eligibility, connectedWallet: WALLET }), true);
  assert.equal(canSubmitActaProposal({ eligibility, connectedWallet: `G${"D".repeat(55)}` }), false);
  assert.equal(canSubmitActaProposal({ eligibility: { ...eligibility, state: "not_eligible" }, connectedWallet: WALLET }), false);
});

test("private proposal fields stay hidden until reveal", () => {
  const draft = actaProposalFromDraft(defaultActaPilotWorkspace().proposalDraft);
  const proposal = {
    id: "p1",
    wallet: WALLET,
    ...draft.record,
    revealed: false,
    valid: true,
    source: "demo" as const,
  };
  assert.equal(JSON.stringify(hiddenActaProposalRows(proposal)).includes(proposal.proposal), false);
  assert.equal(JSON.stringify(hiddenActaProposalRows({ ...proposal, revealed: true })).includes(proposal.proposal), true);
});

test("manual selection only accepts a valid revealed proposal", () => {
  const draft = actaProposalFromDraft(defaultActaPilotWorkspace().proposalDraft);
  const proposal = {
    id: "p1",
    wallet: WALLET,
    ...draft.record,
    revealed: true,
    valid: true,
    source: "demo" as const,
  };
  assert.deepEqual(selectActaProvider([proposal], WALLET), {
    wallet: WALLET,
    name: proposal.providerName,
  });
  assert.throws(() => selectActaProvider([{ ...proposal, revealed: false }], WALLET), /valid revealed/);
});

test("persistence excludes live plaintext proposal drafts and API keys", () => {
  const workspace = defaultActaPilotWorkspace();
  workspace.mode = "live";
  workspace.proposalDraft.proposal = "SECRET_LIVE_PROPOSAL_MARKER";
  workspace.credentialId = "real-reference";
  const serialized = serializeActaPilotWorkspace(workspace);
  assert.equal(serialized.includes("SECRET_LIVE_PROPOSAL_MARKER"), false);
  assert.equal(serialized.includes("apiKey"), false);
  assert.equal(parseActaPilotWorkspace(serialized).credentialId, "real-reference");
});
