import { ActaClient, testNet, type Signer } from "@acta-team/credentials";

export const ACTA_TESTNET_BASE_URL = testNet;
export const ACTA_W3C_CONTEXT = "https://www.w3.org/ns/credentials/v2";

export type ActaCredentialStatus = "valid" | "revoked" | "invalid" | "unknown";
export type ActaEligibilityState =
  | "eligible"
  | "not_eligible"
  | "verification_failed"
  | "configuration_required";
export type ActaOutcomeType = "round_participation" | "selected_provider";

export interface ActaEligibilityPolicy {
  credentialType: string;
  trustedIssuerDid: string;
}

export interface ActaCredentialSummary {
  types: string[];
  issuerDid: string | null;
  subjectDid: string | null;
}

export interface ActaEligibilityReference {
  state: ActaEligibilityState;
  owner: string;
  credentialId: string;
  credentialType: string;
  issuerDid: string | null;
  subjectDid: string | null;
  status: ActaCredentialStatus | null;
  checkedAt: string;
  message: string;
  source: "real" | "demo";
}

export interface ActaOutcomeEvidence {
  roundId: string;
  network: "testnet" | "mainnet";
  subjectWallet: string;
  subjectDid: string;
  validReveal: boolean;
  selectedProviderWallet: string | null;
}

export interface ActaOutcomeCredentialReference {
  credentialId: string;
  outcomeType: ActaOutcomeType;
  owner: string;
  issuerDid: string;
  status: "valid" | "revoked";
  txId: string | null;
  replayed: boolean;
  issuedAt: string;
}

interface ActaSdkClient {
  vaultVerify(args: { owner: string; vcId: string }): Promise<unknown>;
  vaultGetVcDirect(args: { owner: string; vcId: string }): Promise<unknown>;
  getOrCreateIssuerIdentity(args: {
    controller: string;
    signTransaction: Signer;
  }): Promise<{ did: string }>;
  getIssuerIdentity(controller: string): Promise<{ did: string } | null>;
}

interface ActaAdapterOptions {
  apiKey: string;
  baseUrl?: string;
  client?: ActaSdkClient;
  fetcher?: typeof fetch;
  now?: () => Date;
}

export class ActaIntegrationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ActaIntegrationError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function unwrapCredential(value: unknown): Record<string, unknown> | null {
  const parsed = parseJsonValue(value);
  const record = asRecord(parsed);
  if (!record) return null;
  for (const key of ["result", "vc", "credential", "vcData"]) {
    if (key in record) {
      const nested = unwrapCredential(record[key]);
      if (nested) return nested;
    }
  }
  return record;
}

function issuerDidFromCredential(credential: Record<string, unknown>): string | null {
  const issuer = credential.issuer;
  if (typeof issuer === "string") return issuer;
  const issuerRecord = asRecord(issuer);
  if (typeof issuerRecord?.id === "string") return issuerRecord.id;
  return typeof credential.issuerDid === "string" ? credential.issuerDid : null;
}

function credentialTypes(credential: Record<string, unknown>): string[] {
  const value = credential.type;
  if (typeof value === "string") return [value];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function subjectDidFromCredential(credential: Record<string, unknown>): string | null {
  const subject = asRecord(credential.credentialSubject);
  return typeof subject?.id === "string" ? subject.id : null;
}

function statusFromResponse(value: unknown): ActaCredentialStatus {
  const record = asRecord(value);
  const status = record?.status;
  return status === "valid" || status === "revoked" || status === "invalid"
    ? status
    : "unknown";
}

export function isValidActaIssuerDid(value: string, network?: "testnet" | "mainnet"): boolean {
  const match = /^did:stellar:(testnet|mainnet):([a-z2-7]{26})$/.exec(value.trim());
  return Boolean(match && (!network || match[1] === network));
}

export function summarizeActaCredential(value: unknown): ActaCredentialSummary {
  const credential = unwrapCredential(value);
  if (!credential) return { types: [], issuerDid: null, subjectDid: null };
  return {
    types: credentialTypes(credential),
    issuerDid: issuerDidFromCredential(credential),
    subjectDid: subjectDidFromCredential(credential),
  };
}

export function evaluateActaEligibility(params: {
  policy: ActaEligibilityPolicy;
  owner: string;
  credentialId: string;
  status: ActaCredentialStatus;
  credential: unknown;
  checkedAt?: string;
  source?: "real" | "demo";
}): ActaEligibilityReference {
  const summary = summarizeActaCredential(params.credential);
  const base = {
    owner: params.owner,
    credentialId: params.credentialId,
    credentialType: params.policy.credentialType,
    issuerDid: summary.issuerDid,
    subjectDid: summary.subjectDid,
    status: params.status,
    checkedAt: params.checkedAt ?? new Date().toISOString(),
    source: params.source ?? "real",
  } as const;

  if (params.status !== "valid") {
    return {
      ...base,
      state: "not_eligible",
      message: params.status === "revoked"
        ? "The ACTA credential is revoked."
        : "The ACTA credential is not currently valid.",
    };
  }
  if (!summary.types.includes(params.policy.credentialType)) {
    return {
      ...base,
      state: "not_eligible",
      message: `The credential does not include ${params.policy.credentialType}.`,
    };
  }
  if (summary.issuerDid !== params.policy.trustedIssuerDid) {
    return {
      ...base,
      state: "not_eligible",
      message: "The credential issuer is not trusted by this round policy.",
    };
  }
  if (!summary.subjectDid) {
    return {
      ...base,
      state: "verification_failed",
      message: "The credential has no credentialSubject.id.",
    };
  }
  return {
    ...base,
    state: "eligible",
    message: "Credential verified. You are eligible to submit.",
  };
}

export function assertOutcomeEvidence(
  outcomeType: ActaOutcomeType,
  evidence: ActaOutcomeEvidence,
): void {
  if (!/^\d+$/.test(evidence.roundId)) {
    throw new Error("A real Sub Rosa round ID is required before ACTA issuance.");
  }
  if (!evidence.validReveal) {
    throw new Error("A valid revealed Sub Rosa submission is required before ACTA issuance.");
  }
  if (
    outcomeType === "selected_provider" &&
    evidence.selectedProviderWallet !== evidence.subjectWallet
  ) {
    throw new Error("The organizer must select this revealed provider before ACTA issuance.");
  }
}

export function buildActaOutcomeCredential(
  outcomeType: ActaOutcomeType,
  evidence: ActaOutcomeEvidence,
): Record<string, unknown> {
  assertOutcomeEvidence(outcomeType, evidence);
  const type = outcomeType === "round_participation"
    ? "SubRosaRoundParticipationCredential"
    : "SubRosaSelectedProviderCredential";
  return {
    "@context": [ACTA_W3C_CONTEXT],
    type: ["VerifiableCredential", type],
    credentialSubject: {
      id: evidence.subjectDid,
      stellarAccount: evidence.subjectWallet,
      subRosaRoundId: evidence.roundId,
      subRosaNetwork: evidence.network,
      outcome: outcomeType,
    },
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function actaOutcomeCredentialId(params: {
  roundId: string;
  subjectDid: string;
  outcomeType: ActaOutcomeType;
}): Promise<string> {
  const digest = await sha256Hex(`${params.roundId}:${params.subjectDid}:${params.outcomeType}`);
  const outcome = params.outcomeType === "round_participation" ? "participated" : "selected";
  return `sr-${params.roundId.slice(0, 20)}-${outcome}-${digest.slice(0, 16)}`;
}

function actaErrorMessage(payload: unknown, fallback: string): { code: string; message: string } {
  const record = asRecord(payload);
  const nested = asRecord(record?.error);
  const code = typeof record?.code === "string"
    ? record.code
    : typeof record?.error === "string"
      ? record.error
      : typeof nested?.code === "string"
        ? nested.code
        : "acta_request_failed";
  const message = typeof record?.message === "string"
    ? record.message
    : typeof nested?.message === "string"
      ? nested.message
      : fallback;
  return { code, message };
}

export class ActaAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly client: ActaSdkClient;
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;
  private readonly issuanceInFlight = new Map<string, Promise<ActaOutcomeCredentialReference>>();

  constructor(options: ActaAdapterOptions) {
    this.apiKey = options.apiKey.trim();
    if (!this.apiKey) throw new ActaIntegrationError("ACTA API key is required.", "configuration_required");
    this.baseUrl = (options.baseUrl ?? ACTA_TESTNET_BASE_URL).replace(/\/$/, "");
    this.client = options.client ?? new ActaClient(this.baseUrl, this.apiKey);
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async verifyEligibility(params: {
    policy: ActaEligibilityPolicy;
    owner: string;
    credentialId: string;
  }): Promise<ActaEligibilityReference> {
    if (!params.owner.trim() || !params.credentialId.trim()) {
      throw new ActaIntegrationError(
        "Credential owner and credential ID are required.",
        "credential_reference_required",
      );
    }
    try {
      const statusResponse = await this.client.vaultVerify({
        owner: params.owner.trim(),
        vcId: params.credentialId.trim(),
      });
      const status = statusFromResponse(statusResponse);
      if (status !== "valid") {
        return evaluateActaEligibility({
          ...params,
          owner: params.owner.trim(),
          credentialId: params.credentialId.trim(),
          status,
          credential: null,
          checkedAt: this.now().toISOString(),
        });
      }
      const credential = await this.client.vaultGetVcDirect({
        owner: params.owner.trim(),
        vcId: params.credentialId.trim(),
      });
      return evaluateActaEligibility({
        ...params,
        owner: params.owner.trim(),
        credentialId: params.credentialId.trim(),
        status,
        credential,
        checkedAt: this.now().toISOString(),
      });
    } catch (error) {
      if (error instanceof ActaIntegrationError) throw error;
      throw new ActaIntegrationError(
        error instanceof Error ? error.message : "ACTA credential verification failed.",
        "verification_failed",
      );
    }
  }

  issueOutcomeCredential(params: {
    outcomeType: ActaOutcomeType;
    evidence: ActaOutcomeEvidence;
    owner: string;
    issuer: string;
    signTransaction: Signer;
  }): Promise<ActaOutcomeCredentialReference> {
    assertOutcomeEvidence(params.outcomeType, params.evidence);
    const requestKey = [
      params.evidence.roundId,
      params.evidence.subjectDid,
      params.outcomeType,
    ].join(":");
    const existing = this.issuanceInFlight.get(requestKey);
    if (existing) return existing;
    const request = actaOutcomeCredentialId({
      roundId: params.evidence.roundId,
      subjectDid: params.evidence.subjectDid,
      outcomeType: params.outcomeType,
    }).then((credentialId) => this.issueOnce({ ...params, credentialId })).finally(() => {
      this.issuanceInFlight.delete(requestKey);
    });
    this.issuanceInFlight.set(requestKey, request);
    return request;
  }

  private async issueOnce(params: {
    outcomeType: ActaOutcomeType;
    evidence: ActaOutcomeEvidence;
    owner: string;
    issuer: string;
    signTransaction: Signer;
    credentialId: string;
  }): Promise<ActaOutcomeCredentialReference> {
    let current: ActaCredentialStatus = "unknown";
    try {
      current = statusFromResponse(await this.client.vaultVerify({
        owner: params.owner,
        vcId: params.credentialId,
      }));
    } catch {
      // A missing credential is the expected first-issuance path.
    }
    if (current === "valid" || current === "revoked") {
      const identity = await this.client.getIssuerIdentity(params.issuer);
      if (!identity) {
        throw new ActaIntegrationError(
          "The outcome credential exists, but this browser has no matching ACTA issuer identity reference.",
          "issuer_identity_reference_missing",
        );
      }
      return {
        credentialId: params.credentialId,
        outcomeType: params.outcomeType,
        owner: params.owner,
        issuerDid: identity.did,
        status: current,
        txId: null,
        replayed: true,
        issuedAt: this.now().toISOString(),
      };
    }

    const identity = await this.client.getOrCreateIssuerIdentity({
      controller: params.issuer,
      signTransaction: params.signTransaction,
    });
    const payload = buildActaOutcomeCredential(params.outcomeType, params.evidence);
    const prepared = await this.request("/contracts/vc/issue", {
      owner: params.owner,
      vcId: params.credentialId,
      vcData: JSON.stringify(payload),
      issuer: params.issuer,
      issuerDid: identity.did,
      sourcePublicKey: params.issuer,
    }, `prepare-${params.credentialId}-${this.now().getTime()}`);
    const preparedRecord = asRecord(prepared);
    if (typeof preparedRecord?.xdr !== "string" || typeof preparedRecord.network !== "string") {
      throw new ActaIntegrationError("ACTA did not return a signable transaction.", "invalid_prepare_response");
    }
    const signedXdr = await params.signTransaction(preparedRecord.xdr, {
      networkPassphrase: preparedRecord.network,
    });
    const submitted = await this.request(
      "/contracts/vc/issue",
      { signedXdr },
      `issue-${params.credentialId}`,
    );
    const submittedRecord = asRecord(submitted);
    if (typeof submittedRecord?.tx_id !== "string") {
      throw new ActaIntegrationError("ACTA did not return an issuance transaction ID.", "invalid_submit_response");
    }
    return {
      credentialId: params.credentialId,
      outcomeType: params.outcomeType,
      owner: params.owner,
      issuerDid: identity.did,
      status: "valid",
      txId: submittedRecord.tx_id,
      replayed: false,
      issuedAt: this.now().toISOString(),
    };
  }

  private async request(path: string, body: unknown, idempotencyKey: string): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ACTA-Key": this.apiKey,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const detail = actaErrorMessage(payload, `ACTA request failed with HTTP ${response.status}.`);
      throw new ActaIntegrationError(detail.message, detail.code, response.status);
    }
    return payload;
  }
}
