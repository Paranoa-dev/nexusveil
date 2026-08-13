import {
  sealedProposalRound,
  type CreatePartnerRoundV2Params,
  type SealedProposal,
} from "@sub-rosa/sdk";

import type {
  ActaEligibilityPolicy,
  ActaEligibilityReference,
  ActaOutcomeCredentialReference,
} from "../integrations/acta";
import type { PilotSubmissionView } from "./pilotSubmission";

export type ActaPilotMode = "demo" | "live";
export type ActaPilotView = "organizer" | "participant" | "evidence";

export interface ActaProposalDraft {
  providerName: string;
  proposedPrice: string;
  deliveryDays: string;
  proposal: string;
  experience: string;
}

export interface ActaProposalRecord {
  id: string;
  wallet: string | null;
  providerName: string;
  proposedPrice: number;
  deliveryDays: number;
  proposal: string;
  experience: string;
  revealed: boolean;
  valid: boolean;
  source: "demo" | "live";
}

export interface ActaPilotWorkspace {
  mode: ActaPilotMode;
  view: ActaPilotView;
  title: string;
  description: string;
  credentialLabel: string;
  policy: ActaEligibilityPolicy;
  roundId: string | null;
  roundInput: string;
  organizerWallet: string | null;
  deadlineAt: number;
  credentialOwner: string;
  credentialId: string;
  eligibility: ActaEligibilityReference | null;
  proposalDraft: ActaProposalDraft;
  demoProposals: ActaProposalRecord[];
  selectedProviderWallet: string | null;
  selectedProviderName: string | null;
  outcomeCredential: ActaOutcomeCredentialReference | null;
  transactionHashes: string[];
}

export const ACTA_PILOT_STORAGE_KEY = "subrosa-acta-pilot-v1";
export const ACTA_DEFAULT_CREDENTIAL_TYPE = "VerifiedProviderCredential";
export const ACTA_DEFAULT_TRUSTED_ISSUER_DID = "did:stellar:testnet:sd2tszkfg2t7on3clzr3zqlhea";

export function defaultActaProposalDraft(): ActaProposalDraft {
  return {
    providerName: "Northstar Protocol Studio",
    proposedPrice: "1800",
    deliveryDays: "24",
    proposal: "Design and deliver a provider operations workspace with Stellar-native settlement reporting.",
    experience: "Built production Stellar integrations, data pipelines, and partner-facing operational tools.",
  };
}

export function fillEmptyActaProposalDraft(
  draft: ActaProposalDraft,
  defaults = defaultActaProposalDraft(),
): ActaProposalDraft {
  return {
    providerName: draft.providerName.trim() ? draft.providerName : defaults.providerName,
    proposedPrice: draft.proposedPrice.trim() ? draft.proposedPrice : defaults.proposedPrice,
    deliveryDays: draft.deliveryDays.trim() ? draft.deliveryDays : defaults.deliveryDays,
    proposal: draft.proposal.trim() ? draft.proposal : defaults.proposal,
    experience: draft.experience.trim() ? draft.experience : defaults.experience,
  };
}

export function defaultActaPilotWorkspace(now = Date.now()): ActaPilotWorkspace {
  return {
    mode: "demo",
    view: "organizer",
    title: "Verified Provider Selection Round",
    description: "Select a qualified Stellar service provider through a private proposal round.",
    credentialLabel: "Verified Provider",
    policy: {
      credentialType: ACTA_DEFAULT_CREDENTIAL_TYPE,
      trustedIssuerDid: ACTA_DEFAULT_TRUSTED_ISSUER_DID,
    },
    roundId: null,
    roundInput: "",
    organizerWallet: null,
    deadlineAt: now + 120_000,
    credentialOwner: "",
    credentialId: "",
    eligibility: null,
    proposalDraft: defaultActaProposalDraft(),
    demoProposals: [],
    selectedProviderWallet: null,
    selectedProviderName: null,
    outcomeCredential: null,
    transactionHashes: [],
  };
}

export function serializeActaPilotWorkspace(workspace: ActaPilotWorkspace): string {
  const safe = {
    ...workspace,
    proposalDraft: workspace.mode === "live"
      ? { providerName: "", proposedPrice: "", deliveryDays: "", proposal: "", experience: "" }
      : workspace.proposalDraft,
  };
  return JSON.stringify(safe);
}

export function parseActaPilotWorkspace(value: string): ActaPilotWorkspace {
  const fallback = defaultActaPilotWorkspace();
  const parsed = JSON.parse(value) as Partial<ActaPilotWorkspace>;
  const eligibility = parsed.eligibility && typeof parsed.eligibility === "object"
    ? parsed.eligibility
    : null;
  const policy = { ...fallback.policy, ...(parsed.policy ?? {}) };
  if (!policy.trustedIssuerDid.trim()) policy.trustedIssuerDid = fallback.policy.trustedIssuerDid;
  return {
    ...fallback,
    ...parsed,
    policy,
    proposalDraft: { ...fallback.proposalDraft, ...(parsed.proposalDraft ?? {}) },
    demoProposals: Array.isArray(parsed.demoProposals) ? parsed.demoProposals : [],
    transactionHashes: Array.isArray(parsed.transactionHashes) ? parsed.transactionHashes : [],
    eligibility,
  };
}

function positiveNumber(value: string, label: string): number {
  const amount = Number(value.trim().replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`${label} must be positive.`);
  return amount;
}

export function actaProposalFromDraft(draft: ActaProposalDraft): {
  price: bigint;
  proposal: SealedProposal;
  record: Omit<ActaProposalRecord, "id" | "wallet" | "revealed" | "valid" | "source">;
} {
  const providerName = draft.providerName.trim();
  const proposal = draft.proposal.trim();
  const experience = draft.experience.trim();
  const proposedPrice = positiveNumber(draft.proposedPrice, "Proposed price");
  const deliveryDays = positiveNumber(draft.deliveryDays, "Delivery days");
  if (!providerName || !proposal || !experience) throw new Error("Provider, proposal, and experience are required.");
  if (!Number.isSafeInteger(deliveryDays)) throw new Error("Delivery days must be a whole number.");
  return {
    price: BigInt(Math.round(proposedPrice * 10_000_000)),
    proposal: {
      timelineDays: deliveryDays,
      approach: proposal,
      totalAmount: proposedPrice,
      currency: "USDC",
      metadata: {
        providerName,
        relevantExperience: experience,
        workflow: "ACTA x Sub Rosa pilot",
      },
    },
    record: { providerName, proposedPrice, deliveryDays, proposal, experience },
  };
}

export function buildActaRoundParams(params: {
  operator: string;
  itemRef: Uint8Array;
  revealRound: number;
  commitDeadline: number;
  revealDeadline: number;
  auditorPubkey: Uint8Array;
}): CreatePartnerRoundV2Params {
  return sealedProposalRound({
    operator: params.operator,
    itemRef: params.itemRef,
    revealRound: params.revealRound,
    commitDeadline: params.commitDeadline,
    revealDeadline: params.revealDeadline,
    auditorPubkey: params.auditorPubkey,
    maxParticipants: 25,
    eligibleParticipants: [],
  });
}

export function actaProposalFromSubmission(submission: PilotSubmissionView): ActaProposalRecord {
  const metadata = submission.metadata ?? {};
  return {
    id: `live-${submission.bidder}`,
    wallet: submission.bidder,
    providerName: metadata.providerName ?? submission.bidder,
    proposedPrice: submission.totalAmount ?? Number(submission.amount ?? 0) / 10_000_000,
    deliveryDays: submission.timelineDays ?? 0,
    proposal: submission.approach ?? "",
    experience: metadata.relevantExperience ?? "",
    revealed: true,
    valid: submission.valid,
    source: "live",
  };
}

export function sealedActaProposal(wallet: string): ActaProposalRecord {
  return {
    id: `live-${wallet}`,
    wallet,
    providerName: "Sealed participant",
    proposedPrice: 0,
    deliveryDays: 0,
    proposal: "",
    experience: "",
    revealed: false,
    valid: true,
    source: "live",
  };
}

export function canSubmitActaProposal(params: {
  eligibility: ActaEligibilityReference | null;
  connectedWallet: string | null;
}): boolean {
  return Boolean(
    params.connectedWallet &&
    params.eligibility?.state === "eligible" &&
    params.eligibility.owner === params.connectedWallet,
  );
}

export function selectActaProvider(
  proposals: ActaProposalRecord[],
  wallet: string,
): { wallet: string; name: string } {
  const proposal = proposals.find((entry) => entry.wallet === wallet);
  if (!proposal?.revealed || !proposal.valid) {
    throw new Error("Only a valid revealed proposal can be selected.");
  }
  return { wallet, name: proposal.providerName };
}

export function hiddenActaProposalRows(
  proposal: ActaProposalRecord,
): Array<[string, string]> {
  if (!proposal.revealed) {
    return [["Private fields", "Hidden until the shared reveal"]];
  }
  return [
    ["Price", `${proposal.proposedPrice.toLocaleString("en-US")} USDC`],
    ["Delivery", `${proposal.deliveryDays} days`],
    ["Proposal", proposal.proposal],
    ["Experience", proposal.experience],
  ];
}
