import assert from "node:assert/strict";
import test from "node:test";

import {
  ActaAdapter,
  actaOutcomeCredentialId,
  assertOutcomeEvidence,
  buildActaOutcomeCredential,
  evaluateActaEligibility,
  isValidActaIssuerDid,
  type ActaOutcomeEvidence,
} from "./index.js";

const ISSUER = "did:stellar:testnet:sd2tszkfg2t7on3clzr3zqlhea";
const OTHER_ISSUER = "did:stellar:testnet:znfxngsh46vkyqu6inrx4omphi";
const SUBJECT = "did:stellar:testnet:uh2q4w6x7m3j5k8p9r2s4t6v8y";

function credential(issuer = ISSUER) {
  return {
    result: {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      type: ["VerifiableCredential", "VerifiedProviderCredential"],
      issuer,
      credentialSubject: { id: SUBJECT, privateClaim: "must not be retained" },
    },
  };
}

function evidence(overrides: Partial<ActaOutcomeEvidence> = {}): ActaOutcomeEvidence {
  return {
    roundId: "42",
    network: "testnet",
    subjectWallet: `G${"D".repeat(55)}`,
    subjectDid: SUBJECT,
    validReveal: true,
    selectedProviderWallet: `G${"D".repeat(55)}`,
    ...overrides,
  };
}

test("maps ACTA status, type, subject, and trusted issuer into eligibility", () => {
  const result = evaluateActaEligibility({
    policy: { credentialType: "VerifiedProviderCredential", trustedIssuerDid: ISSUER },
    owner: `G${"D".repeat(55)}`,
    credentialId: "provider-credential",
    status: "valid",
    credential: credential(),
    checkedAt: "2026-08-11T00:00:00.000Z",
  });
  assert.equal(result.state, "eligible");
  assert.equal(result.issuerDid, ISSUER);
  assert.equal(result.subjectDid, SUBJECT);
  assert.equal(JSON.stringify(result).includes("privateClaim"), false);
});

test("prefers ACTA's normalized vc over a sibling raw contract result", () => {
  const result = evaluateActaEligibility({
    policy: { credentialType: "SkillBadgeCredential", trustedIssuerDid: ISSUER },
    owner: `G${"D".repeat(55)}`,
    credentialId: "vc-skill-badge",
    status: "valid",
    credential: {
      result: { ledger: 42, value: "raw-contract-result" },
      vc: JSON.stringify({
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "SkillBadgeCredential"],
        issuer: ISSUER,
        credentialSubject: { id: SUBJECT },
      }),
    },
  });

  assert.equal(result.state, "eligible");
  assert.equal(result.issuerDid, ISSUER);
  assert.equal(result.subjectDid, SUBJECT);
});

test("rejects an otherwise valid credential from an untrusted issuer", () => {
  const result = evaluateActaEligibility({
    policy: { credentialType: "VerifiedProviderCredential", trustedIssuerDid: ISSUER },
    owner: `G${"D".repeat(55)}`,
    credentialId: "provider-credential",
    status: "valid",
    credential: credential(OTHER_ISSUER),
  });
  assert.equal(result.state, "not_eligible");
  assert.match(result.message, /not trusted/);
});

test("validates did:stellar issuer syntax and network", () => {
  assert.equal(isValidActaIssuerDid(ISSUER, "testnet"), true);
  assert.equal(isValidActaIssuerDid(ISSUER, "mainnet"), false);
  assert.equal(isValidActaIssuerDid("GNOT_A_DID", "testnet"), false);
  assert.equal(isValidActaIssuerDid("did:stellar:testnet:GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "testnet"), false);
});

test("outcome credentials require a real revealed source event", () => {
  assert.throws(
    () => assertOutcomeEvidence("round_participation", evidence({ validReveal: false })),
    /valid revealed/,
  );
  assert.throws(
    () => assertOutcomeEvidence("selected_provider", evidence({ selectedProviderWallet: null })),
    /must select/,
  );
});

test("builds minimal application claims without proposal contents", () => {
  const payload = buildActaOutcomeCredential("selected_provider", evidence());
  const serialized = JSON.stringify(payload);
  assert.match(serialized, /SubRosaSelectedProviderCredential/);
  assert.match(serialized, /selected_provider/);
  assert.equal(serialized.includes("proposal"), false);
  assert.equal(serialized.includes("price"), false);
});

test("derives stable distinct credential IDs by round, subject, and outcome", async () => {
  const first = await actaOutcomeCredentialId({
    roundId: "42",
    subjectDid: SUBJECT,
    outcomeType: "selected_provider",
  });
  assert.equal(first, await actaOutcomeCredentialId({
    roundId: "42",
    subjectDid: SUBJECT,
    outcomeType: "selected_provider",
  }));
  assert.notEqual(first, await actaOutcomeCredentialId({
    roundId: "42",
    subjectDid: SUBJECT,
    outcomeType: "round_participation",
  }));
  assert.ok(first.length <= 64);
});

test("uses ACTA idempotency on issuance and coalesces duplicate clicks", async () => {
  let identityCalls = 0;
  const requests: Array<{ headers: Headers; body: Record<string, unknown> }> = [];
  const client = {
    vaultVerify: async () => ({ status: "invalid" }),
    vaultGetVcDirect: async () => credential(),
    getIssuerIdentity: async () => ({ did: ISSUER }),
    getOrCreateIssuerIdentity: async () => {
      identityCalls += 1;
      return { did: ISSUER };
    },
  };
  const fetcher: typeof fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ headers, body });
    return new Response(
      "signedXdr" in body
        ? JSON.stringify({ tx_id: "real-acta-tx" })
        : JSON.stringify({ xdr: "unsigned-xdr", network: "Test SDF Network ; September 2015" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const adapter = new ActaAdapter({ apiKey: "runtime-key", client, fetcher });
  const issue = () => adapter.issueOutcomeCredential({
    outcomeType: "selected_provider",
    evidence: evidence(),
    owner: evidence().subjectWallet,
    issuer: `G${"E".repeat(55)}`,
    signTransaction: async () => "signed-xdr",
  });
  const [first, second] = await Promise.all([issue(), issue()]);
  assert.deepEqual(first, second);
  assert.equal(first.txId, "real-acta-tx");
  assert.equal(identityCalls, 1);
  assert.equal(requests.length, 2);
  assert.match(requests[1]!.headers.get("Idempotency-Key") ?? "", /^issue-sr-/);
});

test("refresh-safe issuance returns the existing credential without another write", async () => {
  let fetchCalls = 0;
  const adapter = new ActaAdapter({
    apiKey: "runtime-key",
    client: {
      vaultVerify: async () => ({ status: "valid" }),
      vaultGetVcDirect: async () => credential(),
      getIssuerIdentity: async () => ({ did: ISSUER }),
      getOrCreateIssuerIdentity: async () => {
        throw new Error("must not create a new identity for an existing credential");
      },
    },
    fetcher: async () => {
      fetchCalls += 1;
      return new Response(null, { status: 500 });
    },
  });
  const result = await adapter.issueOutcomeCredential({
    outcomeType: "selected_provider",
    evidence: evidence(),
    owner: evidence().subjectWallet,
    issuer: `G${"E".repeat(55)}`,
    signTransaction: async () => "unused",
  });
  assert.equal(result.replayed, true);
  assert.equal(result.txId, null);
  assert.equal(fetchCalls, 0);
});

test("surfaces missing ACTA configuration and verification failures", async () => {
  assert.throws(() => new ActaAdapter({ apiKey: "" }), /API key is required/);
  const adapter = new ActaAdapter({
    apiKey: "runtime-key",
    client: {
      vaultVerify: async () => {
        throw new Error("ACTA unavailable");
      },
      vaultGetVcDirect: async () => credential(),
      getIssuerIdentity: async () => null,
      getOrCreateIssuerIdentity: async () => ({ did: ISSUER }),
    },
  });
  await assert.rejects(
    () => adapter.verifyEligibility({
      policy: { credentialType: "VerifiedProviderCredential", trustedIssuerDid: ISSUER },
      owner: evidence().subjectWallet,
      credentialId: "provider-credential",
    }),
    /ACTA unavailable/,
  );
});
