import { fromHex, generateNonce, sealPayload } from "@sub-rosa/tlock";
import type {
  DrandClient,
  SealPayloadParams,
  SealedPayload,
} from "@sub-rosa/tlock";

import type {
  CreateRoundV2Params,
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
  CreateRoundV2Params,
  | "mode"
  | "schemaRef"
  | "paymentAsset"
  | "lotAsset"
  | "lotAmount"
  | "clearingRule"
>;

export interface AssetAuctionRoundParams extends SharedRoundParams {
  paymentAsset: string;
  lotAsset: string;
  lotAmount: bigint;
  schemaRef?: Uint8Array;
}

export interface SealedProposalRoundParams extends SharedRoundParams {
  schemaRef?: Uint8Array;
}

export function assetAuctionRound(
  params: AssetAuctionRoundParams,
): CreateRoundV2Params {
  return {
    ...params,
    schemaRef: params.schemaRef ?? ASSET_AUCTION_SCHEMA_REF,
    mode: "Auction",
    clearingRule: "HighestBid",
  };
}

export function sealedProposalRound(
  params: SealedProposalRoundParams,
): CreateRoundV2Params {
  return {
    ...params,
    schemaRef: params.schemaRef ?? SEALED_PROPOSAL_SCHEMA_REF,
    mode: "ReceiptOnly",
    clearingRule: "LowestBid",
  };
}

export function createAssetAuctionRound(
  client: SubRosaClient,
  params: AssetAuctionRoundParams,
): Promise<bigint> {
  return client.createRoundV2(assetAuctionRound(params));
}

export function createSealedProposalRound(
  client: SubRosaClient,
  params: SealedProposalRoundParams,
): Promise<bigint> {
  return client.createRoundV2(sealedProposalRound(params));
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

export function encodeSealedProposal(proposal: SealedProposal): Uint8Array {
  if (!Number.isSafeInteger(proposal.timelineDays) || proposal.timelineDays < 1) {
    throw new Error("timelineDays must be a positive safe integer");
  }
  if (!proposal.approach.trim()) {
    throw new Error("approach must not be empty");
  }
  if (
    proposal.metadata &&
    Object.values(proposal.metadata).some((entry) => typeof entry !== "string")
  ) {
    throw new Error("metadata values must be strings");
  }
  const value = {
    version: 1,
    timelineDays: proposal.timelineDays,
    approach: proposal.approach,
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
