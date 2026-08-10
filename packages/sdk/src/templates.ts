import { fromHex, generateNonce, sealPayload } from "@sub-rosa/tlock";
import type {
  DrandClient,
  SealPayloadParams,
  SealedPayload,
} from "@sub-rosa/tlock";
import { StrKey } from "@stellar/stellar-sdk";

import type {
  CreatePartnerRoundV2Params,
  SubRosaClient,
} from "./client.js";

export const ASSET_AUCTION_SCHEMA_ID = "sub-rosa:asset-auction:v1";
export const SEALED_PROPOSAL_SCHEMA_ID = "sub-rosa:sealed-proposal:v1";
export const ASSET_AUCTION_SCHEMA_REF = fromHex(
  "e65dcd30384792f9e01a06485a7cde26f8b943bc72824fa369691c01d2373dda",
);
export const SEALED_PROPOSAL_SCHEMA_REF = fromHex(
  "b84a413c18205d4e45e80eff8ef29d322fbac1fd2f634b3fca9d9740c6176f6a",
);

type SharedRoundParams = Omit<
  CreatePartnerRoundV2Params,
  | "mode"
  | "schemaRef"
  | "paymentAsset"
  | "lotAsset"
  | "lotAmount"
  | "clearingRule"
  | "fixedEscrow"
>;

export interface AssetAuctionRoundParams extends SharedRoundParams {
  paymentAsset: string;
  lotAsset: string;
  lotAmount: bigint;
  /** Same public escrow cap enforced for every bidder, preventing bid-size leakage. */
  fixedEscrow: bigint;
  schemaRef?: Uint8Array;
}

export interface SealedProposalRoundParams extends SharedRoundParams {
  schemaRef?: Uint8Array;
}

export function assetAuctionRound(
  params: AssetAuctionRoundParams,
): CreatePartnerRoundV2Params {
  return {
    ...params,
    schemaRef: params.schemaRef ?? ASSET_AUCTION_SCHEMA_REF,
    mode: "Auction",
    clearingRule: "HighestBid",
    fixedEscrow: params.fixedEscrow,
  };
}

export function sealedProposalRound(
  params: SealedProposalRoundParams,
): CreatePartnerRoundV2Params {
  return {
    ...params,
    schemaRef: params.schemaRef ?? SEALED_PROPOSAL_SCHEMA_REF,
    mode: "ReceiptOnly",
    clearingRule: "LowestBid",
    fixedEscrow: 0n,
  };
}

export function createAssetAuctionRound(
  client: SubRosaClient,
  params: AssetAuctionRoundParams,
): Promise<bigint> {
  return client.createPartnerRoundV2(assetAuctionRound(params));
}

export function createSealedProposalRound(
  client: SubRosaClient,
  params: SealedProposalRoundParams,
): Promise<bigint> {
  return client.createPartnerRoundV2(sealedProposalRound(params));
}

interface SharedSealParams {
  round: number;
  drand: DrandClient;
  nonce?: Uint8Array;
  identity?: Uint8Array;
  auditorPublicKey?: Uint8Array;
}

export interface SealAssetBidParams extends SharedSealParams {
  amount: bigint;
  /** Partner-defined lot/bid metadata committed alongside the amount. */
  payload?: Uint8Array;
}

function sealArgs(
  params: SharedSealParams,
  amount: bigint | undefined,
  payload: Uint8Array,
): SealPayloadParams {
  return {
    round: params.round,
    client: params.drand,
    nonce: params.nonce ?? generateNonce(),
    payload,
    ...(amount === undefined ? {} : { amount }),
    ...(params.identity === undefined ? {} : { identity: params.identity }),
    ...(params.auditorPublicKey === undefined
      ? {}
      : { auditorPublicKey: params.auditorPublicKey }),
  };
}

export function sealAssetBid(params: SealAssetBidParams): Promise<SealedPayload> {
  return sealPayload(
    sealArgs(params, params.amount, params.payload ?? new Uint8Array()),
  );
}

export interface SealedProposal {
  timelineDays: number;
  approach: string;
  /** Optional human-token proposal total. ReceiptOnly mode does not escrow it. */
  totalAmount?: number;
  /** Optional display / integration currency, e.g. USDC. */
  currency?: string;
  deliverables?: string[];
  milestones?: SealedProposalMilestone[];
  metadata?: Record<string, string>;
}

export interface SealedProposalMilestone {
  title: string;
  description?: string;
  amount: number;
  /** Stellar account that should receive this milestone, when an integration needs it. */
  receiver?: string;
  /** Expected delivery date or duration, kept partner-defined. */
  delivery?: string;
  metadata?: Record<string, string>;
}

export interface SealProposalParams extends SharedSealParams {
  proposal: SealedProposal;
  /** Optional private price. ReceiptOnly mode never escrows this amount. */
  price?: bigint;
}

function canonicalMetadata(
  metadata: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

function safeAmountUnits(value: number, label: string): bigint {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  const units = Math.round(value * 10_000_000);
  if (!Number.isSafeInteger(units)) {
    throw new Error(`${label} is outside the safe amount range`);
  }
  return BigInt(units);
}

function validateMetadata(
  metadata: Record<string, string> | undefined,
  label: string,
): void {
  if (
    metadata &&
    Object.values(metadata).some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`${label} metadata values must be strings`);
  }
}

function normalizeDeliverables(deliverables: string[] | undefined): string[] | undefined {
  if (deliverables === undefined) return undefined;
  if (
    !Array.isArray(deliverables) ||
    deliverables.length > 20 ||
    deliverables.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new Error("deliverables must be a non-empty string array with at most 20 entries");
  }
  return deliverables.map((entry) => entry.trim());
}

function normalizeMilestones(
  milestones: SealedProposalMilestone[] | undefined,
  totalAmount: number | undefined,
): SealedProposalMilestone[] | undefined {
  if (milestones === undefined) return undefined;
  if (!Array.isArray(milestones) || milestones.length < 1 || milestones.length > 10) {
    throw new Error("milestones must contain between 1 and 10 entries");
  }
  if (totalAmount === undefined) {
    throw new Error("totalAmount is required when milestones are provided");
  }

  const totalUnits = safeAmountUnits(totalAmount, "totalAmount");
  let milestoneUnits = 0n;
  const normalized = milestones.map((milestone, index) => {
    if (!milestone || typeof milestone !== "object") {
      throw new Error(`milestone ${index + 1} must be an object`);
    }
    if (typeof milestone.title !== "string" || !milestone.title.trim()) {
      throw new Error(`milestone ${index + 1} title must not be empty`);
    }
    if (
      milestone.description !== undefined &&
      typeof milestone.description !== "string"
    ) {
      throw new Error(`milestone ${index + 1} description must be a string`);
    }
    if (milestone.receiver !== undefined && !StrKey.isValidEd25519PublicKey(milestone.receiver)) {
      throw new Error(`milestone ${index + 1} receiver must be a valid Stellar public key`);
    }
    if (milestone.delivery !== undefined && typeof milestone.delivery !== "string") {
      throw new Error(`milestone ${index + 1} delivery must be a string`);
    }
    validateMetadata(milestone.metadata, `milestone ${index + 1}`);
    milestoneUnits += safeAmountUnits(milestone.amount, `milestone ${index + 1} amount`);
    return {
      title: milestone.title.trim(),
      ...(milestone.description === undefined ? {} : { description: milestone.description.trim() }),
      amount: milestone.amount,
      ...(milestone.receiver === undefined ? {} : { receiver: milestone.receiver }),
      ...(milestone.delivery === undefined ? {} : { delivery: milestone.delivery.trim() }),
      ...(milestone.metadata === undefined
        ? {}
        : { metadata: canonicalMetadata(milestone.metadata) }),
    };
  });

  if (milestoneUnits !== totalUnits) {
    throw new Error("sum(milestone amounts) must equal totalAmount");
  }
  return normalized;
}

export function encodeSealedProposal(proposal: SealedProposal): Uint8Array {
  if (!Number.isSafeInteger(proposal.timelineDays) || proposal.timelineDays < 1) {
    throw new Error("timelineDays must be a positive safe integer");
  }
  if (!proposal.approach.trim()) {
    throw new Error("approach must not be empty");
  }
  if (proposal.totalAmount !== undefined) {
    safeAmountUnits(proposal.totalAmount, "totalAmount");
  }
  if (proposal.currency !== undefined && !proposal.currency.trim()) {
    throw new Error("currency must not be empty");
  }
  validateMetadata(proposal.metadata, "proposal");
  const deliverables = normalizeDeliverables(proposal.deliverables);
  const milestones = normalizeMilestones(proposal.milestones, proposal.totalAmount);
  const value = {
    version: 1,
    timelineDays: proposal.timelineDays,
    approach: proposal.approach,
    ...(proposal.totalAmount === undefined ? {} : { totalAmount: proposal.totalAmount }),
    ...(proposal.currency === undefined ? {} : { currency: proposal.currency.trim() }),
    ...(deliverables === undefined ? {} : { deliverables }),
    ...(milestones === undefined ? {} : { milestones }),
    ...(proposal.metadata
      ? { metadata: canonicalMetadata(proposal.metadata) }
      : {}),
  };
  return new TextEncoder().encode(JSON.stringify(value));
}

export function decodeSealedProposal(payload: Uint8Array): SealedProposal {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("proposal payload must be an object");
  }
  const value = parsed as Record<string, unknown>;
  if (value.version !== 1) throw new Error("unsupported proposal version");
  if (!Number.isSafeInteger(value.timelineDays) || Number(value.timelineDays) < 1) {
    throw new Error("proposal timelineDays is invalid");
  }
  if (typeof value.approach !== "string" || !value.approach.trim()) {
    throw new Error("proposal approach is invalid");
  }
  if (
    value.totalAmount !== undefined &&
    (typeof value.totalAmount !== "number" || !Number.isFinite(value.totalAmount))
  ) {
    throw new Error("proposal totalAmount is invalid");
  }
  if (
    value.currency !== undefined &&
    (typeof value.currency !== "string" || !value.currency.trim())
  ) {
    throw new Error("proposal currency is invalid");
  }
  if (
    value.deliverables !== undefined &&
    (!Array.isArray(value.deliverables) ||
      value.deliverables.some((entry) => typeof entry !== "string" || !entry.trim()))
  ) {
    throw new Error("proposal deliverables are invalid");
  }
  if (
    value.milestones !== undefined &&
    !Array.isArray(value.milestones)
  ) {
    throw new Error("proposal milestones are invalid");
  }
  if (
    value.metadata !== undefined &&
    (!value.metadata ||
      typeof value.metadata !== "object" ||
      Array.isArray(value.metadata) ||
      Object.values(value.metadata).some((entry) => typeof entry !== "string"))
  ) {
    throw new Error("proposal metadata is invalid");
  }
  return {
    timelineDays: Number(value.timelineDays),
    approach: value.approach,
    ...(value.totalAmount === undefined
      ? {}
      : { totalAmount: Number(value.totalAmount) }),
    ...(value.currency === undefined ? {} : { currency: value.currency }),
    ...(value.deliverables === undefined
      ? {}
      : { deliverables: value.deliverables as string[] }),
    ...(value.milestones === undefined
      ? {}
      : {
          milestones: normalizeMilestones(
            value.milestones as SealedProposalMilestone[],
            Number(value.totalAmount),
          ),
        }),
    ...(value.metadata === undefined
      ? {}
      : { metadata: value.metadata as Record<string, string> }),
  };
}

export function sealProposal(params: SealProposalParams): Promise<SealedPayload> {
  return sealPayload(
    sealArgs(params, params.price, encodeSealedProposal(params.proposal)),
  );
}
