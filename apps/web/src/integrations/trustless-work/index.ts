import { rpc, scValToNative, StrKey, TransactionBuilder } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

export interface TrustlessWorkConfig {
  baseUrl: string;
  apiKey: string;
  apiVersion: TrustlessWorkApiVersion;
}

export type TrustlessWorkApiVersion = "v1" | "v2";

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
  unsignedTransaction?: string;
  txHash?: string | null;
  contractId?: string | null | Record<string, unknown>;
  escrow?: TrustlessWorkEscrowSnapshot;
  message?: string;
  status?: string;
  [key: string]: unknown;
}

export interface TrustlessWorkSendTransactionResponse {
  txHash?: string | null;
  ledger?: number;
  contractId?: string;
  resultMetaXdr?: string;
  envelopeXdr?: string;
  escrow?: TrustlessWorkEscrowSnapshot;
  code?: "STELLAR_TX_SUBMITTED" | "STELLAR_TX_SUBMITTED_INDEXER_LAGGING";
  message?: string;
  status?: string;
  [key: string]: unknown;
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
  statusCode?: number;
  code?: string;
  detail?: string;
  message?: string | string[];
  error?: string;
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

const DEFAULT_V1_BASE_URL = "https://dev.api.trustlesswork.com";
const DEFAULT_V2_BASE_URL = "https://beta.api.trustlesswork.com";

function trimUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function normalizeEnvValue(value: string | undefined): string {
  return (value ?? "").trim().replace(/^['"]|['"]$/g, "");
}

function resolveApiVersion(value: string | undefined, baseUrl: string): TrustlessWorkApiVersion {
  const normalized = normalizeEnvValue(value).toLowerCase();
  if (normalized === "2" || normalized === "v2") return "v2";
  if (normalized === "1" || normalized === "v1") return "v1";
  return baseUrl.includes("beta.api.trustlesswork.com") ? "v2" : "v1";
}

export function resolveTrustlessWorkConfig(
  env: Record<string, string | undefined> = import.meta.env,
): TrustlessWorkConfig | null {
  const apiKey = normalizeEnvValue(env.VITE_TRUSTLESS_WORK_API_KEY);
  if (!apiKey) return null;
  const requestedVersion = normalizeEnvValue(env.VITE_TRUSTLESS_WORK_API_VERSION).toLowerCase();
  const defaultBaseUrl = requestedVersion === "v2" || requestedVersion === "2"
    ? DEFAULT_V2_BASE_URL
    : DEFAULT_V1_BASE_URL;
  const baseUrl = trimUrl(normalizeEnvValue(env.VITE_TRUSTLESS_WORK_BASE_URL) || defaultBaseUrl);
  return {
    baseUrl,
    apiKey,
    apiVersion: resolveApiVersion(env.VITE_TRUSTLESS_WORK_API_VERSION, baseUrl),
  };
}

export function trustlessWorkConfigIssues(
  env: Record<string, string | undefined> = import.meta.env,
): string[] {
  const issues: string[] = [];
  if (!normalizeEnvValue(env.VITE_TRUSTLESS_WORK_API_KEY)) {
    issues.push("VITE_TRUSTLESS_WORK_API_KEY is missing.");
  }
  const baseUrl = normalizeEnvValue(env.VITE_TRUSTLESS_WORK_BASE_URL);
  if (baseUrl && !/^https?:\/\//.test(baseUrl)) {
    issues.push("VITE_TRUSTLESS_WORK_BASE_URL must be a valid URL.");
  }
  const apiVersion = normalizeEnvValue(env.VITE_TRUSTLESS_WORK_API_VERSION).toLowerCase();
  if (apiVersion && !["1", "v1", "2", "v2"].includes(apiVersion)) {
    issues.push("VITE_TRUSTLESS_WORK_API_VERSION must be v1 or v2.");
  }
  if (baseUrl && apiVersion === "v1" && baseUrl.includes("beta.api.trustlesswork.com")) {
    issues.push("VITE_TRUSTLESS_WORK_API_VERSION=v1 does not match the beta Trustless Work URL. Use https://dev.api.trustlesswork.com for v1.");
  }
  if (baseUrl && apiVersion === "v2" && baseUrl.includes("dev.api.trustlesswork.com")) {
    issues.push("VITE_TRUSTLESS_WORK_API_VERSION=v2 does not match the v1 dev Trustless Work URL. Use https://beta.api.trustlesswork.com for v2.");
  }
  return issues;
}

function listExtension(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).join(", ")
    : "";
}

function traceSuffix(error: TrustlessWorkApiError): string {
  return error.traceId ? ` Trace ID: ${error.traceId}` : "";
}

export function formatTrustlessWorkApiError(
  error: unknown,
  config?: Partial<Pick<TrustlessWorkConfig, "baseUrl" | "apiVersion">>,
): string {
  if (!(error instanceof TrustlessWorkApiError)) {
    return error instanceof Error ? error.message : String(error);
  }

  const detail = error.details?.detail || error.message;
  const location = config?.baseUrl ? ` at ${config.baseUrl}` : "";
  if (error.code === "AUTH_INVALID_CREDENTIAL" || (error.status === 401 && /invalid api key/i.test(detail))) {
    if (config?.apiVersion === "v2" || config?.baseUrl?.includes("beta.api.trustlesswork.com")) {
      return `Trustless Work rejected this API key${location}. Use a Core v2 beta Testnet key for beta.api.trustlesswork.com; Version 1/dev/mainnet keys are not interchangeable.${traceSuffix(error)}`;
    }
    return `Trustless Work rejected this API key${location}. Use the full v1 API key token from the matching Trustless Work network, not only the key ID.${traceSuffix(error)}`;
  }

  if (error.code === "AUTH_CREDENTIAL_MISSING") {
    return `Trustless Work did not receive an API key. Set VITE_TRUSTLESS_WORK_API_KEY to the full API key token for ${config?.baseUrl ?? "the configured Trustless Work API"}.${traceSuffix(error)}`;
  }

  if (error.code === "AUTH_INSUFFICIENT_ROLE") {
    const required = listExtension(error.details?.extensions?.requiredAnyOf);
    const present = listExtension(error.details?.extensions?.present);
    return `Trustless Work accepted the key, but the key is missing the required role${required ? `: ${required}` : ""}.${present ? ` Present roles: ${present}.` : ""}${traceSuffix(error)}`;
  }

  if (/trustline|asset trust|required asset|receiver/i.test(detail) && /could not be validated|does not have|missing|required/i.test(detail)) {
    return `Trustless Work accepted the key, but a wallet in the escrow does not satisfy the selected asset trustline. The issuer address in Advanced only identifies USDC; it is not the receiver wallet. Add a USDC trustline to the real provider wallet and every milestone receiver, then retry. Original error: ${detail}${traceSuffix(error)}`;
  }

  if (/resultMetaXdr|result meta xdr|transaction response is missing/i.test(detail)) {
    return `Trustless Work may have submitted the transaction but returned incomplete Stellar metadata. The app will verify the transaction on Testnet before reporting failure.${traceSuffix(error)}`;
  }

  if (/MissingValue|non-existing value|get_escrow|Storage/i.test(detail)) {
    return `Trustless Work could not find escrow storage for the submitted contract ID. The app will re-discover the escrow by the organizer signer before retrying funding. Do not create another escrow.${traceSuffix(error)}`;
  }

  return `${error.code ? `${error.code}: ` : ""}${detail}${traceSuffix(error)}`;
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

function detailsMessage(value: TrustlessWorkErrorDetails["message"]): string {
  if (Array.isArray(value)) return value.filter(Boolean).join("; ");
  return typeof value === "string" ? value : "";
}

async function parseError(response: Response): Promise<TrustlessWorkApiError> {
  let details: TrustlessWorkErrorDetails = { status: response.status };
  try {
    const parsed = (await response.clone().json()) as Partial<TrustlessWorkErrorDetails>;
    const message = detailsMessage(parsed.message);
    details = {
      ...details,
      ...parsed,
      status: response.status,
      ...(message && !parsed.detail ? { detail: message } : {}),
      ...(parsed.error && !parsed.title ? { title: parsed.error } : {}),
    };
  } catch {
    const text = await response.clone().text();
    details = {
      ...details,
      title: response.statusText || "Trustless Work request failed",
      detail: text || undefined,
    };
  }
  const message = details.detail || detailsMessage(details.message) || details.title || "Trustless Work request failed";
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

  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
}

export function readContractId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["contractId", "contract_id", "address", "value", "id"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function normalizeUnsignedTransactionResponse(
  response: TrustlessWorkUnsignedTransactionResponse,
): TrustlessWorkUnsignedTransactionResponse {
  const nested = response.data && typeof response.data === "object"
    ? response.data as TrustlessWorkUnsignedTransactionResponse
    : response;
  const unsignedXdr = nested.unsignedXdr || nested.unsignedTransaction;
  if (!unsignedXdr?.trim()) {
    throw new Error("Trustless Work did not return an unsigned transaction XDR.");
  }
  return {
    ...response,
    ...nested,
    unsignedXdr,
  };
}

function normalizeSendTransactionResponse(
  response: TrustlessWorkSendTransactionResponse & { hash?: string },
): TrustlessWorkSendTransactionResponse {
  const nested = response.sendTransactionResponse && typeof response.sendTransactionResponse === "object"
    ? response.sendTransactionResponse as TrustlessWorkSendTransactionResponse & { hash?: string }
    : response.data && typeof response.data === "object"
      ? response.data as TrustlessWorkSendTransactionResponse & { hash?: string }
      : response;
  return {
    ...response,
    ...nested,
    txHash: nested.txHash ?? nested.hash ?? null,
  };
}

export function hashSignedTransaction(signedXdr: string, networkPassphrase: string): string {
  const transaction = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  return Buffer.from(transaction.hash()).toString("hex");
}

export async function waitForTestnetTransaction(
  txHash: string,
  options: { attempts?: number; delayMs?: number; horizonUrl?: string } = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 8;
  const delayMs = options.delayMs ?? 1000;
  const horizonUrl = (options.horizonUrl ?? "https://horizon-testnet.stellar.org").replace(/\/+$/, "");
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`${horizonUrl}/transactions/${encodeURIComponent(txHash)}`);
    if (response.ok) return true;
    if (response.status !== 404) {
      throw new Error(`Testnet transaction lookup failed with HTTP ${response.status}.`);
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
    }
  }
  return false;
}

function findContractId(value: unknown): string | null {
  if (typeof value === "string" && StrKey.isValidContract(value)) return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const contractId = findContractId(entry);
      if (contractId) return contractId;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      const contractId = findContractId(entry);
      if (contractId) return contractId;
    }
  }
  return null;
}

export async function resolveContractIdFromStellarTransaction(
  txHash: string,
  rpcUrl: string,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<string | null> {
  const attempts = options.attempts ?? 10;
  const delayMs = options.delayMs ?? 1500;
  const server = new rpc.Server(rpcUrl);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await server.getTransaction(txHash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      if (!result.returnValue) return null;
      return findContractId(scValToNative(result.returnValue));
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Stellar transaction ${txHash} failed on Testnet.`);
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
    }
  }
  return null;
}

function normalizeGetEscrowResponse(response: unknown): TrustlessWorkGetEscrowResponse {
  if (response && typeof response === "object" && "escrow" in response) {
    const record = response as Partial<TrustlessWorkGetEscrowResponse>;
    return {
      escrow: record.escrow ?? {},
      events: record.events ?? [],
      eventsHasMore: record.eventsHasMore ?? false,
      deposits: record.deposits ?? [],
    };
  }

  const record = response && typeof response === "object"
    ? response as Record<string, unknown>
    : {};
  const entries = Array.isArray(response)
    ? response
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.escrows)
        ? record.escrows
        : [];
  const escrow = entries[0] ?? record;
  if (!escrow || typeof escrow !== "object") {
    throw new Error("Trustless Work did not return escrow data for this contract ID.");
  }
  return {
    escrow: escrow as TrustlessWorkEscrowSnapshot,
    events: [],
    eventsHasMore: false,
    deposits: [],
  };
}

function firstRole(values: string[], label: string): string {
  if (!values.length) throw new Error(`${label} is required`);
  return stellarKey(values[0], label);
}

function validateTrustlessWorkTrustlineV1(
  trustline: TrustlessWorkTrustlineConfig,
): Required<Pick<TrustlessWorkTrustlineConfig, "symbol" | "address">> {
  const symbol = trustline.symbol?.trim();
  const address = trustline.address?.trim();
  if (!symbol || !address) {
    throw new Error("Trustless Work v1 requires trustline symbol + issuer address.");
  }
  return {
    symbol,
    address: stellarKey(address, "trustline.address"),
  };
}

function toTrustlessWorkV1DeployPayload(
  payload: TrustlessWorkDeployMultiReleasePayload,
): Record<string, unknown> {
  const signer = stellarKey(payload.signer, "signer");
  const roles = {
    approver: firstRole(payload.roles.approvers, "roles.approvers[0]"),
    serviceProvider: firstRole(payload.roles.serviceProviders, "roles.serviceProviders[0]"),
    platformAddress: stellarKey(payload.roles.platform, "roles.platform"),
    releaseSigner: firstRole(payload.roles.releaseSigners, "roles.releaseSigners[0]"),
    disputeResolver: firstRole(payload.roles.disputeResolvers, "roles.disputeResolvers[0]"),
  };
  const trustline = validateTrustlessWorkTrustlineV1(payload.trustline);
  const milestones = validateTrustlessWorkMilestones(payload.milestones ?? []).map((milestone) => ({
    description: milestone.description,
    amount: milestone.amount,
    receiver: milestone.receiver,
  }));
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
    roles,
    platformFee,
    milestones,
    trustline,
  };
}

export async function buildMultiReleaseEscrow(
  config: TrustlessWorkConfig,
  payload: TrustlessWorkDeployMultiReleasePayload,
): Promise<TrustlessWorkUnsignedTransactionResponse> {
  const response = await trustlessWorkRequest<TrustlessWorkUnsignedTransactionResponse>(
    config,
    config.apiVersion === "v1" ? "/deployer/multi-release" : "/escrow/multi-release/v2/deploy",
    {
      method: "POST",
      body: config.apiVersion === "v1"
        ? toTrustlessWorkV1DeployPayload(payload)
        : validateTrustlessWorkDeployPayload(payload),
    },
  );
  return normalizeUnsignedTransactionResponse(response);
}

export async function fundMultiReleaseEscrow(
  config: TrustlessWorkConfig,
  payload: { contractId: string; signer: string; amount: number },
): Promise<TrustlessWorkUnsignedTransactionResponse> {
  if (!payload.contractId.trim()) throw new Error("contractId must not be empty");
  stellarKey(payload.signer, "signer");
  positiveNumber(payload.amount, "amount");
  const response = await trustlessWorkRequest<TrustlessWorkUnsignedTransactionResponse>(
    config,
    config.apiVersion === "v1" ? "/escrow/multi-release/fund-escrow" : "/escrow/multi-release/v2/fund",
    {
      method: "POST",
      body: {
        contractId: payload.contractId.trim(),
        signer: payload.signer,
        amount: payload.amount,
      },
    },
  );
  return normalizeUnsignedTransactionResponse(response);
}

export async function sendSignedTransaction(
  config: TrustlessWorkConfig,
  signedXdr: string,
): Promise<TrustlessWorkSendTransactionResponse> {
  if (!signedXdr.trim()) throw new Error("signedXdr must not be empty");
  const response = await trustlessWorkRequest<TrustlessWorkSendTransactionResponse & { hash?: string }>(
    config,
    config.apiVersion === "v1" ? "/helper/send-transaction" : "/stellar/send-transaction",
    { method: "POST", body: { signedXdr } },
  );
  return normalizeSendTransactionResponse(response);
}

export async function getEscrowByContractId(
  config: TrustlessWorkConfig,
  contractId: string,
): Promise<TrustlessWorkGetEscrowResponse> {
  if (!contractId.trim()) throw new Error("contractId must not be empty");
  if (config.apiVersion === "v1") {
    const params = new URLSearchParams();
    params.append("contractIds[]", contractId.trim());
    const response = await trustlessWorkRequest<unknown>(
      config,
      `/helper/get-escrow-by-contract-ids?${params.toString()}`,
    );
    return normalizeGetEscrowResponse(response);
  }

  return normalizeGetEscrowResponse(await trustlessWorkRequest<TrustlessWorkGetEscrowResponse>(
    config,
    `/escrows/${contractId.trim()}`,
  ));
}

export async function getEscrowsBySigner(
  config: TrustlessWorkConfig,
  signer: string,
): Promise<TrustlessWorkEscrowSnapshot[]> {
  if (!signer.trim()) throw new Error("signer must not be empty");
  stellarKey(signer, "signer");
  const params = new URLSearchParams({ signer: signer.trim(), validateOnChain: "true" });
  const response = await trustlessWorkRequest<unknown>(
    config,
    config.apiVersion === "v1"
      ? `/helper/get-escrows-by-signer?${params.toString()}`
      : `/escrows?${params.toString()}`,
  );
  const record = response && typeof response === "object"
    ? response as Record<string, unknown>
    : {};
  const entries = Array.isArray(response)
    ? response
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.escrows)
        ? record.escrows
        : record.escrow && typeof record.escrow === "object"
          ? [record.escrow]
          : [];
  return entries.filter((entry): entry is TrustlessWorkEscrowSnapshot => Boolean(entry && typeof entry === "object"));
}
