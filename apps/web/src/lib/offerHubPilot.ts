import {
  type CoreV2Receipt,
  type CreatePartnerRoundV2Params,
  type SealedProposal,
  sealedProposalRound,
} from "@sub-rosa/sdk";

import type { PilotSubmissionView } from "./pilotSubmission";

export type OfferHubMode = "sample" | "live";
export type OfferHubView = "client" | "provider";
export type OfferHubDeadlinePreset = "2m" | "5m" | "1d";
export type OfferHubProposalSource = "sample" | "demo" | "live";
export type OfferHubStage =
  | "draft"
  | "accepting"
  | "sealed"
  | "deadline"
  | "revealing"
  | "revealed"
  | "selected"
  | "voided";

export const OFFER_HUB_STORAGE_KEY = "subrosa-offer-hub-pilot-v1";

export const OFFER_HUB_DEADLINE_OPTIONS: Array<{
  value: OfferHubDeadlinePreset;
  label: string;
  seconds: number;
}> = [
  { value: "2m", label: "2 min", seconds: 2 * 60 },
  { value: "5m", label: "5 min", seconds: 5 * 60 },
  { value: "1d", label: "1 day", seconds: 24 * 60 * 60 },
];

export const OFFER_HUB_STAGE_LABELS: Record<OfferHubStage, string> = {
  draft: "Draft",
  accepting: "Accepting Proposals",
  sealed: "Sealed",
  deadline: "Deadline Reached",
  revealing: "Revealing",
  revealed: "Revealed",
  selected: "Provider Selected",
  voided: "Voided",
};

export interface OfferHubJobDraft {
  title: string;
  description: string;
  budget: string;
  sealedProposalsEnabled: boolean;
  eligibilityNote: string;
}

export interface OfferHubProposalDraft {
  freelancerName: string;
  providerMeta: string;
  proposedPrice: string;
  estimatedDeliveryDays: string;
  shortProposal: string;
  relevantExperience: string;
  milestoneSummary: string;
}

export interface OfferHubProposalData {
  proposedPrice: number;
  estimatedDeliveryDays: number;
  shortProposal: string;
  relevantExperience: string;
  milestoneSummary: string;
}

export interface OfferHubProposalRecord {
  id: string;
  providerName: string;
  providerMeta: string;
  submittedAt: number;
  revealed: boolean;
  valid: boolean;
  source: OfferHubProposalSource;
  data: OfferHubProposalData;
  wallet?: string;
}

export interface OfferHubWorkspace {
  job: OfferHubJobDraft;
  mode: OfferHubMode;
  view: OfferHubView;
  deadlinePreset: OfferHubDeadlinePreset;
  deadlineAt: number;
  roundId: string | null;
  roundInput: string;
  selectedProviderId: string | null;
  selectedProviderName: string | null;
  proposalDraft: OfferHubProposalDraft;
  sampleProposals: OfferHubProposalRecord[];
  transactionHashes: string[];
  receiptJson: string | null;
  receiptVerified: boolean | null;
}

export interface NormalizedOfferHubProposal {
  freelancerName: string;
  providerMeta: string;
  proposedPrice: number;
  estimatedDeliveryDays: number;
  shortProposal: string;
  relevantExperience: string;
  milestoneSummary: string;
}

export interface OfferHubSealInput {
  price: bigint;
  proposal: SealedProposal;
  recordData: OfferHubProposalData;
  providerName: string;
  providerMeta: string;
}

export interface OfferHubStageInput {
  roundId: string | null;
  protocolStatus?: "Open" | "Revealing" | "Cleared" | "Settled" | "Voided" | null;
  deadlineAt: number;
  now: number;
  proposalCount: number;
  revealedCount: number;
  selectedProviderId: string | null;
}

export interface OfferHubEvidenceSummary {
  kind: "demo" | "real";
  partnerWorkflow: "Offer-Hub";
  subRosaMode: "ReceiptOnly";
  proposalCount: number;
  revealedCount: number;
  selectedProvider: string | null;
  roundId: string | null;
  contractId: string | null;
  receiptAvailable: boolean;
  receiptVerified: boolean | null;
  protocolWinner: string | null;
}

export function defaultOfferHubJob(): OfferHubJobDraft {
  return {
    title: "Build a Stellar merchant analytics dashboard",
    description:
      "Create a dashboard for merchants to monitor Stellar payments, transaction volume and customer activity.",
    budget: "2,000 USDC",
    sealedProposalsEnabled: true,
    eligibilityNote:
      "Offer-Hub keeps freelancer profiles, subscription visibility, and job eligibility outside the Sub Rosa round.",
  };
}

export function defaultOfferHubProposalDraft(): OfferHubProposalDraft {
  return {
    freelancerName: "Nova Labs",
    providerMeta: "Stellar product studio",
    proposedPrice: "1,550",
    estimatedDeliveryDays: "21",
    shortProposal:
      "Design and build a merchant dashboard with payment analytics, customer activity views, and export-ready reporting.",
    relevantExperience:
      "Delivered Stellar payment dashboards, Horizon data jobs, and merchant-facing reporting tools.",
    milestoneSummary:
      "Dashboard UX\nStellar transaction data integration\nFinal QA and analytics handoff",
  };
}

export function emptyOfferHubProposalDraft(): OfferHubProposalDraft {
  return {
    freelancerName: "",
    providerMeta: "",
    proposedPrice: "",
    estimatedDeliveryDays: "",
    shortProposal: "",
    relevantExperience: "",
    milestoneSummary: "",
  };
}

const OFFER_HUB_PROVIDER_PROFILES = [
  {
    name: "Nova Labs",
    meta: "Stellar product studio",
    focus: "merchant KPIs, payment activity, and export-ready reporting",
    experience: "Delivered Stellar payment dashboards and Horizon-backed analytics pipelines.",
    milestones: "Dashboard UX\nPayment data integration\nQA and analytics handoff",
  },
  {
    name: "StellarCraft",
    meta: "Payments analytics team",
    focus: "reliable ledger ingestion, merchant cohorts, and reconciliation views",
    experience: "Built SEP-24 operations tooling and merchant reconciliation products.",
    milestones: "Data model\nDashboard implementation\nReconciliation review",
  },
  {
    name: "Orbit Studio",
    meta: "Freelance design and engineering",
    focus: "a lightweight analytics workspace shaped by early merchant feedback",
    experience: "Designed operational dashboards for crypto checkout and support teams.",
    milestones: "Dashboard MVP\nMerchant feedback pass\nFinal polish",
  },
  {
    name: "LedgerWorks",
    meta: "Stellar data engineering collective",
    focus: "streaming transaction metrics, anomaly detection, and durable data jobs",
    experience: "Operated ledger ingestion and reporting systems for payment platforms.",
    milestones: "Ingestion pipeline\nAnalytics views\nReliability testing",
  },
  {
    name: "Northstar Digital",
    meta: "Fintech product consultancy",
    focus: "merchant segmentation, executive reporting, and accessible dashboard UX",
    experience: "Shipped fintech analytics products from discovery through production rollout.",
    milestones: "Product discovery\nDashboard delivery\nTeam training",
  },
  {
    name: "Quasar Systems",
    meta: "Full-stack Stellar specialists",
    focus: "fast account activity queries, role-based views, and reporting automation",
    experience: "Built Stellar account tooling, indexing services, and internal admin products.",
    milestones: "Technical architecture\nFeature implementation\nPerformance review",
  },
] as const;

function stableProviderHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
  }
  return hash >>> 0;
}

export function offerHubProposalDraftForProvider(
  providerIdentity: string,
  variation = 0,
): OfferHubProposalDraft {
  const hash = stableProviderHash(`${providerIdentity.trim()}:${variation}`);
  const profile = OFFER_HUB_PROVIDER_PROFILES[hash % OFFER_HUB_PROVIDER_PROFILES.length]!;
  const proposedPrice = 1_225 + (hash % 28) * 25;
  const estimatedDeliveryDays = 14 + ((hash >>> 8) % 19);
  return {
    freelancerName: profile.name,
    providerMeta: profile.meta,
    proposedPrice: proposedPrice.toLocaleString("en-US"),
    estimatedDeliveryDays: estimatedDeliveryDays.toString(),
    shortProposal:
      `Deliver the Stellar merchant dashboard in ${estimatedDeliveryDays} days, focusing on ${profile.focus}.`,
    relevantExperience: profile.experience,
    milestoneSummary: profile.milestones,
  };
}

export function isOfferHubProposalDraftPristine(
  draft: OfferHubProposalDraft,
): boolean {
  const fallback = defaultOfferHubProposalDraft();
  const keys = Object.keys(fallback) as Array<keyof OfferHubProposalDraft>;
  return (
    keys.every((key) => !draft[key].trim()) ||
    keys.every((key) => draft[key] === fallback[key])
  );
}

export function deadlineSeconds(preset: OfferHubDeadlinePreset): number {
  return OFFER_HUB_DEADLINE_OPTIONS.find((entry) => entry.value === preset)?.seconds ?? 5 * 60;
}

export function sampleOfferHubProposals(now = Date.now()): OfferHubProposalRecord[] {
  return [
    {
      id: "sample-nova-labs",
      providerName: "Nova Labs",
      providerMeta: "Stellar product studio",
      submittedAt: now - 90_000,
      revealed: false,
      valid: true,
      source: "sample",
      data: {
        proposedPrice: 1550,
        estimatedDeliveryDays: 21,
        shortProposal:
          "Build the dashboard shell, merchant KPIs, and payment activity tables with export support.",
        relevantExperience:
          "Shipped two Stellar merchant reporting products and recurring payment analytics.",
        milestoneSummary:
          "UX prototype, ledger data integration, QA and handoff",
      },
    },
    {
      id: "sample-stellarcraft",
      providerName: "StellarCraft",
      providerMeta: "Payments analytics team",
      submittedAt: now - 54_000,
      revealed: false,
      valid: true,
      source: "sample",
      data: {
        proposedPrice: 1825,
        estimatedDeliveryDays: 18,
        shortProposal:
          "Focus on reliable Stellar payment ingestion, merchant cohorts, and clean operational reporting.",
        relevantExperience:
          "Built reconciliation tools for SEP-24 and merchant payment operations.",
        milestoneSummary:
          "Data model, dashboard implementation, reconciliation views",
      },
    },
    {
      id: "sample-orbit-studio",
      providerName: "Orbit Studio",
      providerMeta: "Freelance design and engineering",
      submittedAt: now - 28_000,
      revealed: false,
      valid: true,
      source: "sample",
      data: {
        proposedPrice: 1320,
        estimatedDeliveryDays: 28,
        shortProposal:
          "Deliver a lightweight analytics workspace first, then iterate with merchant feedback.",
        relevantExperience:
          "Designed dashboards for crypto checkout teams and customer support operators.",
        milestoneSummary:
          "Dashboard MVP, feedback pass, final polish",
      },
    },
  ];
}

export function defaultOfferHubWorkspace(now = Date.now()): OfferHubWorkspace {
  return {
    job: defaultOfferHubJob(),
    mode: "sample",
    view: "client",
    deadlinePreset: "5m",
    deadlineAt: now + deadlineSeconds("5m") * 1000,
    roundId: null,
    roundInput: "",
    selectedProviderId: null,
    selectedProviderName: null,
    proposalDraft: defaultOfferHubProposalDraft(),
    sampleProposals: sampleOfferHubProposals(now),
    transactionHashes: [],
    receiptJson: null,
    receiptVerified: null,
  };
}

export function parseUsdcAmount(value: string, label: string): number {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized || !/^\d+(?:\.\d{1,7})?$/.test(normalized)) {
    throw new Error(`${label} must be a positive USDC amount`);
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be positive`);
  }
  return amount;
}

export function usdcToStroops(amount: number, label = "USDC amount"): bigint {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be positive`);
  }
  const units = Math.round(amount * 10_000_000);
  if (!Number.isSafeInteger(units)) {
    throw new Error(`${label} is outside the safe amount range`);
  }
  return BigInt(units);
}

export function normalizeOfferHubProposalDraft(
  draft: OfferHubProposalDraft,
): NormalizedOfferHubProposal {
  const freelancerName = draft.freelancerName.trim();
  const providerMeta = draft.providerMeta.trim() || "Offer-Hub freelancer";
  const shortProposal = draft.shortProposal.trim();
  const relevantExperience = draft.relevantExperience.trim();
  const milestoneSummary = draft.milestoneSummary.trim();
  const proposedPrice = parseUsdcAmount(draft.proposedPrice, "proposed price");
  const estimatedDeliveryDays = Number(draft.estimatedDeliveryDays.trim());

  if (!freelancerName) throw new Error("freelancer name is required");
  if (!Number.isSafeInteger(estimatedDeliveryDays) || estimatedDeliveryDays < 1) {
    throw new Error("estimated delivery time must be a positive whole number of days");
  }
  if (!shortProposal) throw new Error("short proposal is required");
  if (!relevantExperience) throw new Error("relevant experience is required");

  return {
    freelancerName,
    providerMeta,
    proposedPrice,
    estimatedDeliveryDays,
    shortProposal,
    relevantExperience,
    milestoneSummary,
  };
}

function milestoneLines(value: string): string[] | undefined {
  const lines = value
    .split(/\n|;/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20);
  return lines.length ? lines : undefined;
}

export function offerHubSealInputFromDraft(
  draft: OfferHubProposalDraft,
): OfferHubSealInput {
  const normalized = normalizeOfferHubProposalDraft(draft);
  return {
    price: usdcToStroops(normalized.proposedPrice, "proposed price"),
    providerName: normalized.freelancerName,
    providerMeta: normalized.providerMeta,
    recordData: {
      proposedPrice: normalized.proposedPrice,
      estimatedDeliveryDays: normalized.estimatedDeliveryDays,
      shortProposal: normalized.shortProposal,
      relevantExperience: normalized.relevantExperience,
      milestoneSummary: normalized.milestoneSummary,
    },
    proposal: {
      timelineDays: normalized.estimatedDeliveryDays,
      approach: normalized.shortProposal,
      totalAmount: normalized.proposedPrice,
      currency: "USDC",
      deliverables: milestoneLines(normalized.milestoneSummary),
      metadata: {
        providerName: normalized.freelancerName,
        providerMeta: normalized.providerMeta,
        relevantExperience: normalized.relevantExperience,
        milestoneSummary: normalized.milestoneSummary,
        workflow: "Offer-Hub pilot",
      },
    },
  };
}

export function buildOfferHubRoundParams(params: {
  job: OfferHubJobDraft;
  operator: string;
  itemRef: Uint8Array;
  revealRound: number | bigint;
  commitDeadline: number | bigint;
  revealDeadline: number | bigint;
  auditorPubkey: Uint8Array;
  eligibleParticipants?: string[];
}): CreatePartnerRoundV2Params {
  if (!params.job.title.trim()) throw new Error("job title is required");
  if (!params.job.sealedProposalsEnabled) {
    throw new Error("sealed proposals must be enabled for an Offer-Hub ReceiptOnly round");
  }
  return sealedProposalRound({
    itemRef: params.itemRef,
    revealRound: params.revealRound,
    commitDeadline: params.commitDeadline,
    revealDeadline: params.revealDeadline,
    auditorPubkey: params.auditorPubkey,
    maxParticipants: 25,
    operator: params.operator,
    eligibleParticipants: params.eligibleParticipants ?? [],
  });
}

export function offerHubSealedProposalForBidder(
  bidder: string,
): OfferHubProposalRecord {
  return {
    id: `live-${bidder}`,
    providerName: "Sealed provider",
    providerMeta: "Hidden until reveal",
    wallet: bidder,
    submittedAt: Date.now(),
    revealed: false,
    valid: true,
    source: "live",
    data: {
      proposedPrice: 0,
      estimatedDeliveryDays: 0,
      shortProposal: "",
      relevantExperience: "",
      milestoneSummary: "",
    },
  };
}

export function offerHubProposalFromSubmission(
  submission: PilotSubmissionView,
): OfferHubProposalRecord {
  const metadata = submission.metadata ?? {};
  const proposedPrice = submission.totalAmount ??
    (submission.amount ? Number(submission.amount) / 10_000_000 : 0);
  const milestoneSummary = metadata.milestoneSummary ??
    (submission.deliverables ?? []).join(" | ");
  return {
    id: `live-${submission.bidder}`,
    providerName: metadata.providerName ?? submission.bidder,
    providerMeta: metadata.providerMeta ?? "Stellar wallet",
    wallet: submission.bidder,
    submittedAt: Date.now(),
    revealed: true,
    valid: submission.valid,
    source: "live",
    data: {
      proposedPrice,
      estimatedDeliveryDays: submission.timelineDays ?? 1,
      shortProposal: submission.approach ?? "",
      relevantExperience: metadata.relevantExperience ?? "",
      milestoneSummary,
    },
  };
}

export function offerHubLiveConfigurationIssues(params: {
  contractId: string | null;
  walletAddress: string | null;
}): string[] {
  const issues: string[] = [];
  if (!params.contractId) issues.push("VITE_CONTRACT_ID is not configured.");
  if (!params.walletAddress) issues.push("Connect a Freighter wallet for signed actions.");
  return issues;
}

export function upsertOfferHubProposal(
  proposals: OfferHubProposalRecord[],
  next: OfferHubProposalRecord,
): OfferHubProposalRecord[] {
  const index = proposals.findIndex((entry) =>
    entry.id === next.id ||
    (next.wallet !== undefined && entry.wallet === next.wallet),
  );
  if (index < 0) return [...proposals, next];
  const copy = proposals.slice();
  copy[index] = next;
  return copy;
}

export function offerHubProposalRows(
  proposal: OfferHubProposalRecord,
  revealed: boolean,
): Array<[string, string]> {
  if (!revealed) {
    return [
      ["Status", "Sealed"],
      ["Private fields", "Hidden until the shared deadline"],
    ];
  }
  return [
    ["Price", `${proposal.data.proposedPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`],
    ["Delivery", `${proposal.data.estimatedDeliveryDays} days`],
    ["Proposal", proposal.data.shortProposal],
    ["Experience", proposal.data.relevantExperience],
    ["Milestones", proposal.data.milestoneSummary || "Not specified"],
  ];
}

export function deriveOfferHubStage(input: OfferHubStageInput): OfferHubStage {
  if (input.selectedProviderId) return "selected";
  if (input.protocolStatus === "Voided") return "voided";
  if (input.protocolStatus === "Settled" || input.protocolStatus === "Cleared") {
    return "revealed";
  }
  if (input.proposalCount > 0 && input.revealedCount >= input.proposalCount) {
    return "revealed";
  }
  if (input.protocolStatus === "Revealing") return "revealing";
  if (!input.roundId && input.proposalCount === 0) return "draft";
  if (input.now >= input.deadlineAt) return "deadline";
  if (input.proposalCount > 0) return "sealed";
  return "accepting";
}

export function canSelectOfferHubProvider(stage: OfferHubStage): boolean {
  return stage === "revealed" || stage === "selected";
}

export function selectOfferHubProvider(
  proposals: OfferHubProposalRecord[],
  providerId: string,
  stage: OfferHubStage,
): { selectedProviderId: string; selectedProviderName: string } {
  if (!canSelectOfferHubProvider(stage)) {
    throw new Error("Provider selection unlocks after proposals are revealed");
  }
  const provider = proposals.find((entry) => entry.id === providerId);
  if (!provider) throw new Error("Selected provider was not found");
  return {
    selectedProviderId: provider.id,
    selectedProviderName: provider.providerName,
  };
}

export function offerHubEvidenceSummary(params: {
  mode: OfferHubMode;
  proposalCount: number;
  revealedCount: number;
  selectedProviderName: string | null;
  roundId: string | null;
  contractId: string | null;
  receipt: CoreV2Receipt | null;
  receiptVerified: boolean | null;
}): OfferHubEvidenceSummary {
  if (params.mode === "sample") {
    return {
      kind: "demo",
      partnerWorkflow: "Offer-Hub",
      subRosaMode: "ReceiptOnly",
      proposalCount: params.proposalCount,
      revealedCount: params.revealedCount,
      selectedProvider: params.selectedProviderName,
      roundId: null,
      contractId: null,
      receiptAvailable: false,
      receiptVerified: null,
      protocolWinner: null,
    };
  }
  return {
    kind: "real",
    partnerWorkflow: "Offer-Hub",
    subRosaMode: "ReceiptOnly",
    proposalCount: params.proposalCount,
    revealedCount: params.revealedCount,
    selectedProvider: params.selectedProviderName,
    roundId: params.receipt?.roundId ?? params.roundId,
    contractId: params.receipt?.contractId ?? params.contractId,
    receiptAvailable: params.receipt !== null,
    receiptVerified: params.receiptVerified,
    protocolWinner: params.receipt?.mode === "ReceiptOnly" ? null : params.receipt?.winner ?? null,
  };
}

export function serializeOfferHubWorkspace(state: OfferHubWorkspace): string {
  return JSON.stringify({
    ...state,
    proposalDraft: state.mode === "live"
      ? emptyOfferHubProposalDraft()
      : state.proposalDraft,
  });
}

export function parseOfferHubWorkspace(json: string): OfferHubWorkspace {
  const parsed = JSON.parse(json) as Partial<OfferHubWorkspace>;
  const fallback = defaultOfferHubWorkspace();
  return {
    ...fallback,
    ...parsed,
    job: { ...fallback.job, ...(parsed.job ?? {}) },
    proposalDraft: { ...fallback.proposalDraft, ...(parsed.proposalDraft ?? {}) },
    sampleProposals: Array.isArray(parsed.sampleProposals)
      ? parsed.sampleProposals
      : fallback.sampleProposals,
    transactionHashes: Array.isArray(parsed.transactionHashes)
      ? parsed.transactionHashes
      : [],
    selectedProviderId: parsed.selectedProviderId ?? null,
    selectedProviderName: parsed.selectedProviderName ?? null,
    roundId: parsed.roundId ?? null,
    roundInput: parsed.roundInput ?? parsed.roundId ?? "",
    receiptJson: parsed.receiptJson ?? null,
    receiptVerified: parsed.receiptVerified ?? null,
  };
}
