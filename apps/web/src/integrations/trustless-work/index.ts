import { StrKey } from "@stellar/stellar-sdk";

export interface TrustlessWorkConfig {
  baseUrl: string;
  apiKey: string;
}

export interface TrustlessWorkRoleConfig {
  approvers: string[];
  serviceProviders: string[];
  platform: string;
  releaseSigners: string[];
  disputeResolvers: string[];
  admin: string;
  observers?: string[];
}

export interface TrustlessWorkTrustlineConfig {
  contractId?: string;
  symbol?: string;
  address?: string;
}

export interface TrustlessWorkMilestoneInput {
  description: string;
  amount: number;
  receiver: string;
  status?: string;
  approvalsTarget?: number;
}

export interface TrustlessWorkDeployMultiReleasePayload {
  signer: string;
  engagementId: string;
  title: string;
  description: string;
  roles: TrustlessWorkRoleConfig;
  platformFee: number;
  milestones?: TrustlessWorkMilestoneInput[];
  trustline: TrustlessWorkTrustlineConfig;
  receiverMemo?: number;
}

export interface TrustlessWorkUnsignedTransactionResponse {
  unsignedXdr: string;
  txHash: string;
  contractId?: string | null | Record<string, unknown>;
}

export interface TrustlessWorkSendTransactionResponse {
  txHash: string;
  ledger: number;
  contractId?: string;
  escrow?: TrustlessWorkEscrowSnapshot;
  code?: "STELLAR_TX_SUBMITTED" | "STELLAR_TX_SUBMITTED_INDEXER_LAGGING";
  message?: string;
}

export interface TrustlessWorkEscrowSnapshot {
  contractId?: string;
  engagementId?: string;
  title?: string;
  description?: string;
  amount?: number;
  platformFee?: number;
  balance?: number;
  type?: "single-release" | "multi-release";
  roles?: TrustlessWorkRoleConfig | Record<string, unknown>;
  trustline?: TrustlessWorkTrustlineConfig;
  milestones?: Array<
    {
      description?: string;
      amount?: number;
      receiver?: string;
      status?: string;
      approvalsTarget?: number;
      flags?: Record<string, boolean>;
      evidence?: string;
    } & Record<string, unknown>
  >;
  flags?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface TrustlessWorkGetEscrowResponse {
  escrow: TrustlessWorkEscrowSnapshot;
  events: unknown[];
  eventsHasMore: boolean;
  deposits: unknown[];
}

export interface TrustlessWorkErrorDetails {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  traceId?: string;
  instance?: string;
  extensions?: Record<string, unknown>;
}

export class TrustlessWorkApiError extends Error {
  status: number;
  code?: string;
  traceId?: string;
  details?: TrustlessWorkErrorDetails;

  constructor(message: string, init: TrustlessWorkErrorDetails & { status: number }) {
    super(message);
    this.name = "TrustlessWorkApiError";
    this.status = init.status;
    this.code = init.code;
    this.traceId = init.traceId;
    this.details = init;
  }
}

const DEFAULT_BASE_URL = "https://beta.api.trustlesswork.com";

function trimUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function resolveTrustlessWorkConfig(
  env: Record<string, string | undefined> = import.meta.env,
): TrustlessWorkConfig | null {
  const apiKey = env.VITE_TRUSTLESS_WORK_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    baseUrl: trimUrl(env.VITE_TRUSTLESS_WORK_BASE_URL || DEFAULT_BASE_URL),
    apiKey,
  };
}

export function trustlessWorkConfigIssues(
  env: Record<string, string | undefined> = import.meta.env,
): string[] {
  const issues: string[] = [];
  if (!env.VITE_TRUSTLESS_WORK_API_KEY?.trim()) {
    issues.push("VITE_TRUSTLESS_WORK_API_KEY is missing.");
  }
  const baseUrl = env.VITE_TRUSTLESS_WORK_BASE_URL?.trim();
  if (baseUrl && !/^https?:\/\//.test(baseUrl)) {
    issues.push("VITE_TRUSTLESS_WORK_BASE_URL must be a valid URL.");
  }
  return issues;
}

function stellarKey(value: string | undefined, label: string): string {
  if (!value || !StrKey.isValidEd25519PublicKey(value)) {
    throw new Error(`${label} must be a valid Stellar public key`);
  }
  return value;
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateTrustlessWorkRoleConfig(
  roles: TrustlessWorkRoleConfig,
): void {
  const approvers = roles.approvers.map((entry, index) =>
    stellarKey(entry, `roles.approvers[${index}]`),
  );
  const serviceProviders = roles.serviceProviders.map((entry, index) =>
    stellarKey(entry, `roles.serviceProviders[${index}]`),
  );
  const releaseSigners = roles.releaseSigners.map((entry, index) =>
    stellarKey(entry, `roles.releaseSigners[${index}]`),
  );
  const disputeResolvers = roles.disputeResolvers.map((entry, index) =>
    stellarKey(entry, `roles.disputeResolvers[${index}]`),
  );
  const platform = stellarKey(roles.platform, "roles.platform");
  const admin = stellarKey(roles.admin, "roles.admin");
  const observers = roles.observers?.map((entry, index) =>
    stellarKey(entry, `roles.observers[${index}]`),
  ) ?? [];

  if (!approvers.length || !serviceProviders.length || !releaseSigners.length || !disputeResolvers.length) {
    throw new Error("roles must include approvers, serviceProviders, releaseSigners, and disputeResolvers");
  }
  if (approvers.length > 5 || serviceProviders.length > 5 || releaseSigners.length > 5 || disputeResolvers.length > 5) {
    throw new Error("role arrays must not exceed 5 entries");
  }
  if (!unique(approvers)) throw new Error("roles.approvers must not contain duplicates");
  if (!unique(serviceProviders)) throw new Error("roles.serviceProviders must not contain duplicates");
  if (!unique(releaseSigners)) throw new Error("roles.releaseSigners must not contain duplicates");
  if (!unique(disputeResolvers)) throw new Error("roles.disputeResolvers must not contain duplicates");
  if (!unique(observers)) throw new Error("roles.observers must not contain duplicates");
  const allRoleAddrs = new Set([
    ...approvers,
    ...serviceProviders,
    ...releaseSigners,
    ...disputeResolvers,
    platform,
    admin,
    ...observers,
  ]);
  if (allRoleAddrs.size !== approvers.length + serviceProviders.length + releaseSigners.length + disputeResolvers.length + observers.length + 2) {
    throw new Error("Trustless Work roles must be distinct across functional roles");
  }
  if (admin === platform) throw new Error("roles.admin must be distinct from roles.platform");
}

export function validateTrustlessWorkTrustline(
  trustline: TrustlessWorkTrustlineConfig,
): TrustlessWorkTrustlineConfig {
  if (trustline.contractId?.trim()) {
    if (!StrKey.isValidContract(trustline.contractId.trim())) {
      throw new Error("trustline.contractId must be a valid Stellar contract address");
    }
    return { contractId: trustline.contractId.trim() };
  }

  if (!trustline.symbol?.trim() || !trustline.address?.trim()) {
    throw new Error("trustline requires either contractId or symbol + address");
  }
  if (!StrKey.isValidEd25519PublicKey(trustline.address.trim())) {
    throw new Error("trustline.address must be a valid Stellar public key");
  }
  return {
    symbol: trustline.symbol.trim(),
    address: trustline.address.trim(),
  };
}

function positiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return value;
}

export function validateTrustlessWorkMilestones(
  milestones: TrustlessWorkMilestoneInput[],
): TrustlessWorkMilestoneInput[] {
  if (!Array.isArray(milestones) || milestones.length < 1 || milestones.length > 10) {
    throw new Error("milestones must contain between 1 and 10 entries");
  }

  let total = 0;
  const normalized = milestones.map((milestone, index) => {
    if (!milestone || typeof milestone !== "object") {
      throw new Error(`milestone ${index + 1} must be an object`);
    }
    const description = milestone.description?.trim();
    if (!description) {
      throw new Error(`milestone ${index + 1} description must not be empty`);
    }
    const receiver = stellarKey(milestone.receiver, `milestone ${index + 1} receiver`);
    const amount = positiveNumber(milestone.amount, `milestone ${index + 1} amount`);
    total += amount;
    return {
      description,
      amount,
      receiver,
      ...(milestone.status === undefined ? {} : { status: milestone.status.trim() }),
      ...(milestone.approvalsTarget === undefined
        ? {}
        : { approvalsTarget: positiveNumber(milestone.approvalsTarget, `milestone ${index + 1} approvalsTarget`) }),
    };
  });

  if (total <= 0) {
    throw new Error("milestones must add up to a positive amount");
  }

  return normalized;
}

export function validateTrustlessWorkDeployPayload(
  payload: TrustlessWorkDeployMultiReleasePayload,
): TrustlessWorkDeployMultiReleasePayload {
  const signer = stellarKey(payload.signer, "signer");
  validateTrustlessWorkRoleConfig(payload.roles);
  const trustline = validateTrustlessWorkTrustline(payload.trustline);
  const milestones = payload.milestones
    ? validateTrustlessWorkMilestones(payload.milestones)
    : undefined;
  const platformFee = Number.isFinite(payload.platformFee) && payload.platformFee >= 0
    ? payload.platformFee
    : (() => {
        throw new Error("platformFee must be a non-negative number");
      })();
  if (!payload.engagementId.trim()) throw new Error("engagementId must not be empty");
  if (!payload.title.trim()) throw new Error("title must not be empty");
  if (!payload.description.trim()) throw new Error("description must not be empty");

  return {
    signer,
    engagementId: payload.engagementId.trim(),
    title: payload.title.trim(),
    description: payload.description.trim(),
    roles: payload.roles,
    platformFee,
    ...(milestones === undefined ? {} : { milestones }),
    trustline,
    ...(payload.receiverMemo === undefined ? {} : { receiverMemo: payload.receiverMemo }),
  };
}

export interface TrustlessWorkRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

async function parseError(response: Response): Promise<TrustlessWorkApiError> {
  let details: TrustlessWorkErrorDetails = { status: response.status };
  try {
    const parsed = (await response.clone().json()) as Partial<TrustlessWorkErrorDetails>;
    details = { ...details, ...parsed };
  } catch {
    const text = await response.clone().text();
    details = {
      ...details,
      title: response.statusText || "Trustless Work request failed",
      detail: text || undefined,
    };
  }
  const message = details.detail || details.title || "Trustless Work request failed";
  return new TrustlessWorkApiError(message, details as TrustlessWorkErrorDetails & { status: number });
}

export async function trustlessWorkRequest<T>(
  config: TrustlessWorkConfig,
  path: string,
  options: TrustlessWorkRequestOptions = {},
): Promise<T> {
  const response = await fetch(new URL(path, config.baseUrl), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export function readContractId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["contractId", "address", "value", "id"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export async function buildMultiReleaseEscrow(
  config: TrustlessWorkConfig,
  payload: TrustlessWorkDeployMultiReleasePayload,
): Promise<TrustlessWorkUnsignedTransactionResponse> {
  return trustlessWorkRequest<TrustlessWorkUnsignedTransactionResponse>(
    config,
    "/escrow/multi-release/v2/deploy",
    { method: "POST", body: validateTrustlessWorkDeployPayload(payload) },
  );
}

export async function fundMultiReleaseEscrow(
  config: TrustlessWorkConfig,
  payload: { contractId: string; signer: string; amount: number },
): Promise<TrustlessWorkUnsignedTransactionResponse> {
  if (!payload.contractId.trim()) throw new Error("contractId must not be empty");
  stellarKey(payload.signer, "signer");
  positiveNumber(payload.amount, "amount");
  return trustlessWorkRequest<TrustlessWorkUnsignedTransactionResponse>(
    config,
    "/escrow/multi-release/v2/fund",
    {
      method: "POST",
      body: {
        contractId: payload.contractId.trim(),
        signer: payload.signer,
        amount: payload.amount,
      },
    },
  );
}

export async function sendSignedTransaction(
  config: TrustlessWorkConfig,
  signedXdr: string,
): Promise<TrustlessWorkSendTransactionResponse> {
  if (!signedXdr.trim()) throw new Error("signedXdr must not be empty");
  return trustlessWorkRequest<TrustlessWorkSendTransactionResponse>(
    config,
    "/stellar/send-transaction",
    { method: "POST", body: { signedXdr } },
  );
}

export async function getEscrowByContractId(
  config: TrustlessWorkConfig,
  contractId: string,
): Promise<TrustlessWorkGetEscrowResponse> {
  if (!contractId.trim()) throw new Error("contractId must not be empty");
  return trustlessWorkRequest<TrustlessWorkGetEscrowResponse>(
    config,
    `/escrows/${contractId.trim()}`,
  );
}
