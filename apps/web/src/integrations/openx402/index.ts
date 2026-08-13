import {
  SEALED_PROPOSAL_SCHEMA_REF,
  decodeSealedProposal,
  sealedProposalRound,
  type SealedProposal,
  type SealedProposalRoundParams,
} from "@sub-rosa/sdk";
import { decodePayloadEnvelope } from "@sub-rosa/tlock";

export const OPENX402_DISCOVERY_MODE = "fixture" as const;
export const OPENX402_DISCOVERY_LABEL = "DEMO DISCOVERY DATA";
export const OPENX402_OFFER_VERSION = "1";
export const OPENX402_STORAGE_KEY = "subrosa-openx402-pilot-v1";

export interface OpenX402ServiceRequest {
  id: string;
  title: string;
  description: string;
  maximumPaymentBaseUnits: string;
  currency: string;
  decimals: number;
}

export interface OpenX402Resource {
  id: string;
  resource: string;
  provider: string;
  publicListedAmountBaseUnits: string | null;
  network: string;
  asset: string;
  payTo: string;
  metadataDigest: string;
  resourceDigest: string;
  source: "fixture" | "real";
}

export interface OpenX402Offer {
  bidder: string;
  provider: string;
  resourceId: string;
  resourceDigest: string;
  quotedAmountBaseUnits: string;
  network: string;
  asset: string;
  payTo: string;
  estimatedResponseSeconds: number;
  terms: string;
  validUntil: number;
  metadataDigest?: string;
}

export interface OpenX402OfferDraft {
  resourceId: string;
  quotedAmount: string;
  estimatedResponseSeconds: string;
  terms: string;
  validityMinutes: string;
}

export interface OpenX402OfferValidation {
  valid: boolean;
  code:
    | "valid"
    | "resource_not_discovered"
    | "resource_changed"
    | "invalid_amount"
    | "above_allowance"
    | "network_mismatch"
    | "asset_mismatch"
    | "payee_mismatch"
    | "expired_offer";
  message: string;
}

export interface EvaluatedOpenX402Offer extends OpenX402Offer {
  validation: OpenX402OfferValidation;
}

export interface OpenX402DiscoveryResult {
  mode: "fixture" | "real";
  label: string;
  resources: OpenX402Resource[];
}

export interface OpenX402DiscoveryAdapter {
  discoverResources(request: OpenX402ServiceRequest): Promise<OpenX402DiscoveryResult>;
}

export interface OpenX402PaymentRequirement {
  resourceId: string;
  resource: string;
  network: string;
  asset: string;
  payTo: string;
  amountBaseUnits: string;
  validUntil: number;
  source: "real";
}

export type OpenX402PaymentHandoff =
  | {
      status: "interface_confirmation_required";
      selectedOffer: OpenX402Offer;
      message: string;
    }
  | {
      status: "dynamic_pricing_not_supported";
      selectedOffer: OpenX402Offer;
      requirement: OpenX402PaymentRequirement;
      message: string;
    }
  | {
      status: "payment_requirement_changed";
      selectedOffer: OpenX402Offer;
      requirement: OpenX402PaymentRequirement;
      code: Exclude<OpenX402OfferValidation["code"], "valid" | "above_allowance" | "expired_offer"> | "requirement_expired";
      message: string;
    }
  | {
      status: "ready_for_external_execution";
      selectedOffer: OpenX402Offer;
      requirement: OpenX402PaymentRequirement;
      message: string;
    };

export interface OpenX402PaymentAdapter {
  preparePayment(params: {
    resource: OpenX402Resource;
    selectedOffer: OpenX402Offer;
    maximumPaymentBaseUnits: string;
    paymentRequirement?: OpenX402PaymentRequirement;
    now?: number;
  }): OpenX402PaymentHandoff;
  executePayment(handoff: OpenX402PaymentHandoff): Promise<never>;
}

const textEncoder = new TextEncoder();

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function resourceIdentity(resource: Omit<OpenX402Resource, "resourceDigest">) {
  return {
    id: resource.id,
    resource: resource.resource,
    provider: resource.provider,
    publicListedAmountBaseUnits: resource.publicListedAmountBaseUnits,
    network: resource.network,
    asset: resource.asset,
    payTo: resource.payTo,
    metadataDigest: resource.metadataDigest,
    source: resource.source,
  };
}

export async function openX402ResourceDigest(
  resource: Omit<OpenX402Resource, "resourceDigest">,
): Promise<string> {
  return sha256(canonical(resourceIdentity(resource)));
}

async function fixtureResource(
  input: Omit<OpenX402Resource, "resourceDigest" | "source">,
): Promise<OpenX402Resource> {
  const resource = { ...input, source: "fixture" as const };
  return { ...resource, resourceDigest: await openX402ResourceDigest(resource) };
}

export const DEFAULT_OPENX402_REQUEST: OpenX402ServiceRequest = {
  id: "stellar-wallet-risk-summary-v1",
  title: "Analyze a Stellar wallet and return a risk summary",
  description: "Return a concise wallet risk classification with supporting indicators.",
  maximumPaymentBaseUnits: "5000000",
  currency: "USDC",
  decimals: 6,
};

export class FixtureOpenX402DiscoveryAdapter implements OpenX402DiscoveryAdapter {
  async discoverResources(_request: OpenX402ServiceRequest): Promise<OpenX402DiscoveryResult> {
    const shared = {
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    };
    const resources = await Promise.all([
      fixtureResource({
        id: "demo:atlas-risk-api",
        resource: "demo://openx402/atlas-risk-api/wallet-summary",
        provider: "Atlas Risk API",
        publicListedAmountBaseUnits: "4200000",
        payTo: "demo:payee:atlas-risk-api",
        metadataDigest: await sha256("atlas-risk-api:v1"),
        ...shared,
      }),
      fixtureResource({
        id: "demo:orbit-analysis",
        resource: "demo://openx402/orbit-analysis/wallet-summary",
        provider: "Orbit Analysis",
        publicListedAmountBaseUnits: "3900000",
        payTo: "demo:payee:orbit-analysis",
        metadataDigest: await sha256("orbit-analysis:v1"),
        ...shared,
      }),
      fixtureResource({
        id: "demo:stellarscope",
        resource: "demo://openx402/stellarscope/wallet-summary",
        provider: "StellarScope",
        publicListedAmountBaseUnits: "4500000",
        payTo: "demo:payee:stellarscope",
        metadataDigest: await sha256("stellarscope:v1"),
        ...shared,
      }),
    ]);
    return { mode: "fixture", label: OPENX402_DISCOVERY_LABEL, resources };
  }
}

export function amountToBaseUnits(value: string, decimals: number): string {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) throw new Error("Quote must be a positive decimal amount");
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) throw new Error(`Quote supports at most ${decimals} decimal places`);
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (units <= 0n) throw new Error("Quote must be greater than zero");
  return units.toString();
}

export function formatBaseUnits(value: string, decimals: number, currency: string): string {
  const units = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = units / scale;
  const fraction = (units % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} ${currency}`;
}

export function defaultOpenX402OfferDraft(resourceId: string): OpenX402OfferDraft {
  return {
    resourceId,
    quotedAmount: "3.50",
    estimatedResponseSeconds: "45",
    terms: "One wallet risk summary with classification and supporting indicators.",
    validityMinutes: "20",
  };
}

export function mapOpenX402Offer(params: {
  draft: OpenX402OfferDraft;
  resource: OpenX402Resource;
  bidder: string;
  decimals: number;
  now?: number;
}): OpenX402Offer {
  const responseSeconds = Number(params.draft.estimatedResponseSeconds);
  const validityMinutes = Number(params.draft.validityMinutes);
  if (!Number.isSafeInteger(responseSeconds) || responseSeconds < 1) {
    throw new Error("Estimated response time must be a positive whole number of seconds");
  }
  if (!Number.isSafeInteger(validityMinutes) || validityMinutes < 1) {
    throw new Error("Validity must be a positive whole number of minutes");
  }
  if (!params.draft.terms.trim()) throw new Error("Service terms are required");
  const now = params.now ?? Math.floor(Date.now() / 1000);
  return {
    bidder: params.bidder,
    provider: params.resource.provider,
    resourceId: params.resource.id,
    resourceDigest: params.resource.resourceDigest,
    quotedAmountBaseUnits: amountToBaseUnits(params.draft.quotedAmount, params.decimals),
    network: params.resource.network,
    asset: params.resource.asset,
    payTo: params.resource.payTo,
    estimatedResponseSeconds: responseSeconds,
    terms: params.draft.terms.trim(),
    validUntil: now + validityMinutes * 60,
    metadataDigest: params.resource.metadataDigest,
  };
}

export function openX402OfferToProposal(offer: OpenX402Offer): SealedProposal {
  return {
    timelineDays: 1,
    approach: offer.terms,
    metadata: {
      openX402OfferVersion: OPENX402_OFFER_VERSION,
      provider: offer.provider,
      resourceId: offer.resourceId,
      resourceDigest: offer.resourceDigest,
      quotedAmountBaseUnits: offer.quotedAmountBaseUnits,
      network: offer.network,
      asset: offer.asset,
      payTo: offer.payTo,
      estimatedResponseSeconds: String(offer.estimatedResponseSeconds),
      validUntil: String(offer.validUntil),
      ...(offer.metadataDigest ? { metadataDigest: offer.metadataDigest } : {}),
    },
  };
}

function requiredMetadata(metadata: Record<string, string> | undefined, key: string): string {
  const value = metadata?.[key];
  if (!value) throw new Error(`OpenX402 offer metadata is missing ${key}`);
  return value;
}

export function openX402OfferFromProposal(proposal: SealedProposal, bidder: string): OpenX402Offer {
  const metadata = proposal.metadata;
  if (requiredMetadata(metadata, "openX402OfferVersion") !== OPENX402_OFFER_VERSION) {
    throw new Error("Unsupported OpenX402 offer version");
  }
  const estimatedResponseSeconds = Number(requiredMetadata(metadata, "estimatedResponseSeconds"));
  const validUntil = Number(requiredMetadata(metadata, "validUntil"));
  if (!Number.isSafeInteger(estimatedResponseSeconds) || estimatedResponseSeconds < 1) {
    throw new Error("OpenX402 offer response time is invalid");
  }
  if (!Number.isSafeInteger(validUntil) || validUntil < 1) {
    throw new Error("OpenX402 offer validity is invalid");
  }
  return {
    bidder,
    provider: requiredMetadata(metadata, "provider"),
    resourceId: requiredMetadata(metadata, "resourceId"),
    resourceDigest: requiredMetadata(metadata, "resourceDigest"),
    quotedAmountBaseUnits: requiredMetadata(metadata, "quotedAmountBaseUnits"),
    network: requiredMetadata(metadata, "network"),
    asset: requiredMetadata(metadata, "asset"),
    payTo: requiredMetadata(metadata, "payTo"),
    estimatedResponseSeconds,
    terms: proposal.approach,
    validUntil,
    ...(metadata?.metadataDigest ? { metadataDigest: metadata.metadataDigest } : {}),
  };
}

export function decodeOpenX402OfferEnvelope(bytes: Uint8Array, bidder: string): OpenX402Offer {
  const envelope = decodePayloadEnvelope(bytes);
  const proposal = decodeSealedProposal(envelope.payload);
  const offer = openX402OfferFromProposal(proposal, bidder);
  if (envelope.amount?.toString() !== offer.quotedAmountBaseUnits) {
    throw new Error("Sealed amount does not match the OpenX402 offer quote");
  }
  return offer;
}

export function buildOpenX402RoundParams(
  params: Omit<SealedProposalRoundParams, "schemaRef">,
): ReturnType<typeof sealedProposalRound> {
  return sealedProposalRound({ ...params, schemaRef: SEALED_PROPOSAL_SCHEMA_REF });
}

function invalid(code: OpenX402OfferValidation["code"], message: string): OpenX402OfferValidation {
  return { valid: false, code, message };
}

export function validateOpenX402Offer(params: {
  offer: OpenX402Offer;
  resources: OpenX402Resource[];
  maximumPaymentBaseUnits: string;
  now?: number;
}): OpenX402OfferValidation {
  const resource = params.resources.find((candidate) => candidate.id === params.offer.resourceId);
  if (!resource) return invalid("resource_not_discovered", "Resource was not part of discovery");
  if (resource.resourceDigest !== params.offer.resourceDigest) {
    return invalid("resource_changed", "Discovered resource metadata changed after the offer was sealed");
  }
  let amount: bigint;
  try {
    amount = BigInt(params.offer.quotedAmountBaseUnits);
  } catch {
    return invalid("invalid_amount", "Quoted amount is not valid base-unit data");
  }
  if (amount <= 0n) return invalid("invalid_amount", "Quoted amount must be positive");
  if (amount > BigInt(params.maximumPaymentBaseUnits)) {
    return invalid("above_allowance", "Quoted amount exceeds the buyer spending policy");
  }
  if (params.offer.network !== resource.network) return invalid("network_mismatch", "Offer network does not match discovery");
  if (params.offer.asset !== resource.asset) return invalid("asset_mismatch", "Offer asset does not match discovery");
  if (params.offer.payTo !== resource.payTo) return invalid("payee_mismatch", "Offer payee does not match discovery");
  if (params.offer.validUntil <= (params.now ?? Math.floor(Date.now() / 1000))) {
    return invalid("expired_offer", "Offer validity deadline has passed");
  }
  return { valid: true, code: "valid", message: "Valid revealed offer" };
}

export interface OpenX402SelectionPolicy {
  id: string;
  select(offers: EvaluatedOpenX402Offer[]): EvaluatedOpenX402Offer | null;
}

export const lowestValidOpenX402OfferPolicy: OpenX402SelectionPolicy = {
  id: "lowest-valid-offer-v1",
  select(offers) {
    return [...offers]
      .filter((offer) => offer.validation.valid)
      .sort((left, right) => {
        const amountOrder = BigInt(left.quotedAmountBaseUnits) < BigInt(right.quotedAmountBaseUnits)
          ? -1
          : BigInt(left.quotedAmountBaseUnits) > BigInt(right.quotedAmountBaseUnits)
            ? 1
            : 0;
        return amountOrder || left.resourceId.localeCompare(right.resourceId) || left.bidder.localeCompare(right.bidder);
      })[0] ?? null;
  },
};

export function evaluateAndSelectOpenX402Offer(params: {
  offers: OpenX402Offer[];
  resources: OpenX402Resource[];
  maximumPaymentBaseUnits: string;
  now?: number;
  policy?: OpenX402SelectionPolicy;
}): { evaluated: EvaluatedOpenX402Offer[]; selected: EvaluatedOpenX402Offer | null; policyId: string } {
  const evaluated = params.offers.map((offer) => ({
    ...offer,
    validation: validateOpenX402Offer({
      offer,
      resources: params.resources,
      maximumPaymentBaseUnits: params.maximumPaymentBaseUnits,
      now: params.now,
    }),
  }));
  const policy = params.policy ?? lowestValidOpenX402OfferPolicy;
  return { evaluated, selected: policy.select(evaluated), policyId: policy.id };
}

export class TypedOpenX402PaymentAdapter implements OpenX402PaymentAdapter {
  #execution: Promise<never> | null = null;

  preparePayment(params: {
    resource: OpenX402Resource;
    selectedOffer: OpenX402Offer;
    maximumPaymentBaseUnits: string;
    paymentRequirement?: OpenX402PaymentRequirement;
    now?: number;
  }): OpenX402PaymentHandoff {
    const validation = validateOpenX402Offer({
      offer: params.selectedOffer,
      resources: [params.resource],
      maximumPaymentBaseUnits: params.maximumPaymentBaseUnits,
      now: params.now,
    });
    if (!validation.valid) {
      throw new Error(`${validation.code}: ${validation.message}`);
    }
    if (!params.paymentRequirement) {
      return {
        status: "interface_confirmation_required",
        selectedOffer: params.selectedOffer,
        message: "OpenX402 pricing interface confirmation required",
      };
    }
    const requirement = params.paymentRequirement;
    const mismatch = requirement.resourceId !== params.resource.id || requirement.resource !== params.resource.resource
      ? { code: "resource_changed" as const, message: "Payment requirement resource does not match the selected discovery resource" }
      : requirement.network !== params.selectedOffer.network
        ? { code: "network_mismatch" as const, message: "Payment requirement network changed" }
        : requirement.asset !== params.selectedOffer.asset
          ? { code: "asset_mismatch" as const, message: "Payment requirement asset changed" }
          : requirement.payTo !== params.selectedOffer.payTo
            ? { code: "payee_mismatch" as const, message: "Payment requirement payee changed" }
            : requirement.validUntil <= (params.now ?? Math.floor(Date.now() / 1000))
              ? { code: "requirement_expired" as const, message: "Payment requirement is no longer fresh" }
              : null;
    if (mismatch) {
      return {
        status: "payment_requirement_changed",
        selectedOffer: params.selectedOffer,
        requirement,
        ...mismatch,
      };
    }
    if (requirement.amountBaseUnits !== params.selectedOffer.quotedAmountBaseUnits) {
      return {
        status: "dynamic_pricing_not_supported",
        selectedOffer: params.selectedOffer,
        requirement,
        message: "The selected sealed quote cannot be mapped to this fixed x402 payment requirement",
      };
    }
    return {
      status: "ready_for_external_execution",
      selectedOffer: params.selectedOffer,
      requirement,
      message: "Requirement matches the selected quote; execution still belongs to the confirmed OpenX402 buyer interface",
    };
  }

  executePayment(_handoff: OpenX402PaymentHandoff): Promise<never> {
    if (this.#execution) return this.#execution;
    this.#execution = Promise.reject(
      new Error("OpenX402 payment execution is unavailable until the official selected-quote interface is confirmed"),
    );
    this.#execution.catch(() => undefined);
    return this.#execution;
  }
}

export interface PersistedOpenX402Workspace {
  version: 1;
  mode: "demo" | "live";
  view: "buyer" | "provider" | "evidence";
  discoveryComplete: boolean;
  resources: OpenX402Resource[];
  roundId: string | null;
  commitDurationSeconds: 60 | 120 | 300;
  deadlineAt: number | null;
  sealedOfferCount: number;
  revealComplete: boolean;
  revealedOffers: OpenX402Offer[];
  selectedResourceId: string | null;
  paymentHandoffStatus: OpenX402PaymentHandoff["status"] | null;
  transactionHashes: string[];
}

export function defaultOpenX402Workspace(): PersistedOpenX402Workspace {
  return {
    version: 1,
    mode: "demo",
    view: "buyer",
    discoveryComplete: false,
    resources: [],
    roundId: null,
    commitDurationSeconds: 60,
    deadlineAt: null,
    sealedOfferCount: 0,
    revealComplete: false,
    revealedOffers: [],
    selectedResourceId: null,
    paymentHandoffStatus: null,
    transactionHashes: [],
  };
}

export function serializeOpenX402Workspace(workspace: PersistedOpenX402Workspace): string {
  return JSON.stringify({
    ...workspace,
    revealedOffers: workspace.revealComplete ? workspace.revealedOffers : [],
  });
}

export function parseOpenX402Workspace(raw: string | null): PersistedOpenX402Workspace {
  if (!raw) return defaultOpenX402Workspace();
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedOpenX402Workspace>;
    if (parsed.version !== 1 || !["demo", "live"].includes(parsed.mode ?? "")) {
      return defaultOpenX402Workspace();
    }
    const base = defaultOpenX402Workspace();
    return {
      ...base,
      ...parsed,
      view: ["buyer", "provider", "evidence"].includes(parsed.view ?? "")
        ? parsed.view as PersistedOpenX402Workspace["view"]
        : base.view,
      commitDurationSeconds: [60, 120, 300].includes(parsed.commitDurationSeconds ?? 0)
        ? parsed.commitDurationSeconds as PersistedOpenX402Workspace["commitDurationSeconds"]
        : base.commitDurationSeconds,
      resources: Array.isArray(parsed.resources) ? parsed.resources : [],
      revealedOffers: parsed.revealComplete && Array.isArray(parsed.revealedOffers)
        ? parsed.revealedOffers
        : [],
      transactionHashes: Array.isArray(parsed.transactionHashes)
        ? parsed.transactionHashes.filter((value): value is string => typeof value === "string")
        : [],
    };
  } catch {
    return defaultOpenX402Workspace();
  }
}
