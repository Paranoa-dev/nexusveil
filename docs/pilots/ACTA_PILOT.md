# ACTA x Sub Rosa Pilot

Route: `#/pilot/acta`

Status: credential-gated private-submission pilot. This is not an official ACTA
production integration or partnership announcement.

## Purpose

Validate ACTA as a credential layer around Sub Rosa private submission
workflows:

```text
ACTA credential
  -> application eligibility policy
  -> Sub Rosa sealed ReceiptOnly submission
  -> deadline and reveal
  -> organizer-confirmed application outcome
  -> ACTA outcome credential
```

The pilot uses a "Verified Provider Selection Round". It demonstrates two
independent Stellar building blocks without moving partner business logic into
the Sub Rosa contract.

## Pre-Round Flow

The participant supplies the owner address and ID of a real ACTA credential.
The ACTA adapter then:

1. calls ACTA `verify-vc` for the on-chain lifecycle status;
2. calls ACTA `get-vc` with the holder-bound standard API key;
3. checks the configured W3C credential `type`;
4. checks the exact `did:stellar` issuer against the organizer's trusted
   issuer policy;
5. retains only status and references, not the credential payload;
6. enables the Sub Rosa commit action only for the connected credential owner.

ACTA status alone is not sufficient for eligibility. ACTA documents that
issuance into a vault is open by default, so a relying application must also
check the issuer it trusts.

The default `VerifiedProviderCredential` type is pilot application vocabulary,
not a claim that ACTA publishes a standard provider schema. It is configurable
and should be replaced with the credential type and issuer policy approved by
the ACTA team.

## Post-Round Flow

The pilot supports `SubRosaSelectedProviderCredential` after all of these
source facts exist:

- a real numeric Sub Rosa round ID;
- a valid revealed submission from the subject wallet;
- an explicit organizer selection of that same wallet;
- a retained ACTA `credentialSubject.id` from real eligibility verification.

The credential payload contains only the W3C VC 2.0 context, application
credential type, subject DID and wallet, Sub Rosa network and round ID, and
outcome type. It never includes price, proposal text, experience, or other
private proposal fields.

Credential IDs are deterministic over `round + subject DID + outcome type`.
Before issuance the adapter checks whether that ID already exists. Concurrent
clicks are coalesced in memory, and the ACTA submit request uses the official
`Idempotency-Key` header. This prevents accidental duplicate issuance on click
or network retry.

## Exact ACTA Integration

The web package uses `@acta-team/credentials@1.1.8` against ACTA Testnet:

- `ActaClient.vaultVerify` for credential lifecycle status;
- `ActaClient.vaultGetVcDirect` for owner-authorized credential metadata;
- `ActaClient.getOrCreateIssuerIdentity` for ACTA's documented automatic
  `did:stellar` issuer onboarding;
- ACTA `POST /contracts/vc/issue` prepare/sign/submit for issuance;
- `Idempotency-Key` on prepare and submit HTTP calls;
- Freighter signs every ACTA state-changing XDR locally.

No ACTA endpoint, response, credential ID, issuer signature, attestation, or
transaction hash is fabricated.

Official references:

- <https://docs.acta.build/introduction>
- <https://docs.acta.build/verify-credentials>
- <https://docs.acta.build/sdk-overview>
- <https://docs.acta.build/security>
- <https://docs.acta.build/api-overview>

## Exact Sub Rosa Flow

Live mode reuses the existing Sub Rosa stack:

- SDK `sealedProposalRound` maps the scenario to `ReceiptOnly` with zero
  escrow;
- SDK `sealProposal` encrypts the structured provider proposal locally;
- Core v2 `create_round_v2`, `commit_v2`, `open_reveal_v2`, `reveal_v2`, and
  `clear_v2` run the normal lifecycle;
- SDK `exportReceiptV2` and `verifyReceiptV2` provide canonical evidence.

The Sub Rosa contract is unchanged. No ACTA-specific contract endpoint or
second encryption implementation exists.

## Why ReceiptOnly

The organizer compares price, delivery time, proposal quality, and experience.
Lowest price is not a deterministic winner rule for this business workflow.
`ReceiptOnly` therefore proves the sealed submission and reveal lifecycle but
does not select a provider or move escrow.

Provider selection is application-level state. The ACTA outcome credential
describes that organizer-confirmed statement; it must not imply that Soroban
selected the provider.

## Trust Model

ACTA owns:

- credential infrastructure and lifecycle status;
- `did:stellar` issuer identity;
- wallet-signed credential issuance and revocation semantics;
- encrypted credential storage according to the ACTA protocol.

Sub Rosa owns:

- proposal sealing and pre-deadline confidentiality;
- shared round deadline and Drand reveal;
- canonical round receipts.

The organizer application owns:

- required credential type;
- trusted issuer policy;
- the application-level eligibility gate;
- manual provider selection and underlying business outcome.

ACTA attests a statement produced by the underlying workflow; it is not the
oracle that determines whether the business event happened.

## Enforcement Boundary

The configured Sub Rosa deployment has no ACTA-aware contract authorization.
Eligibility is enforced by the pilot application before `commit_v2`. A modified
client could bypass this UI check and submit to an open round. The UI and
evidence label this boundary explicitly.

A production hard gate would require an independently verifiable authorization
artifact or a contract policy extension. That is outside this pilot and is not
silently claimed here.

## Issuer Policy

The organizer configures an exact testnet `did:stellar` trusted issuer. A
credential must be valid, contain the configured credential type, and have that
issuer DID. Random issuers are not accepted merely because their credentials
are active.

For outcome issuance, the round organizer wallet acts as issuer and signs the
ACTA transaction. ACTA automatically creates or reuses that wallet's issuer DID.
The holder vault owner and the API-key wallet must satisfy ACTA's ownership
binding.

## Data Privacy

Persisted in browser `localStorage`:

- round ID and organizer wallet;
- ACTA credential owner, credential ID, lifecycle status, type, issuer DID,
  subject DID, and verification timestamp;
- application selection;
- real transaction and outcome credential references;
- demo-only proposals in Demo mode.

Intentionally not persisted:

- ACTA API key;
- full credential payload or additional claims;
- live plaintext proposal draft;
- issuer private keys in the pilot workspace `localStorage` (the ACTA SDK may
  retain its client-side issuer identity in IndexedDB according to its official
  custody model);
- wallet signatures or unsigned/signed XDR.

No credential claims are placed in the Sub Rosa receipt, public route, or
Stellar transaction by this pilot.

## Configuration

Sub Rosa Live mode uses the normal web testnet configuration:

```bash
VITE_STELLAR_NETWORK=testnet
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_CONTRACT_ID=CCZBS4N2CHRDIFRTPBVQHAH5JJLPZIXLG7EY3T7KP7Z6YERTUCBMYN4P
```

ACTA defaults to `https://api.testnet.acta.build`. A custom documented ACTA
environment can be selected with:

```bash
VITE_ACTA_BASE_URL=https://api.testnet.acta.build
VITE_ACTA_API_KEY=your_holder_bound_pilot_key
```

For local pilot convenience, the ACTA standard API key can be supplied through
`VITE_ACTA_API_KEY` in `.env.local`, or entered at runtime. It must be bound to
the credential vault owner. Vite embeds `VITE_*` values in the browser build,
so use the environment option only for a disposable pilot key and never commit
it. Runtime keys remain in React memory. Neither path writes the key to local
storage or the persisted pilot workspace. Freighter must be connected to
Stellar Testnet.

## Demo vs Real

Demo mode:

- uses a local, explicitly labeled eligibility decision;
- stores a local sample proposal and reveal state;
- creates no ACTA credential, Stellar transaction, round ID, or receipt;
- displays no fake DID, credential ID, or transaction hash.

Live mode:

- calls real ACTA Testnet reads when a real key and credential reference are
  supplied;
- creates and advances a real Sub Rosa testnet ReceiptOnly round;
- displays only returned round IDs and transaction hashes;
- performs real ACTA issuance only after the underlying source event exists;
- otherwise remains visibly `CONFIGURATION REQUIRED`.

## Current Integration Question

ACTA's documented ownership enforcement requires the `owner` on `issue` to
match the wallet bound to the standard API key, while the issuance XDR is signed
by the issuer. The standalone pilot can demonstrate this holder-mediated flow
in one browser session without persisting the key. Before production, ask ACTA
to confirm the recommended multi-party handoff for an organizer issuing into a
participant-owned vault without sharing the participant's API key with the
organizer application.

## Future Integration

```text
Existing Stellar application
  -> ACTA credential eligibility
  -> Sub Rosa private competitive round
  -> application-confirmed business outcome
  -> ACTA portable credential
```

This adapter pattern lets another Stellar application preserve its own identity,
selection, and fulfillment architecture. It composes ACTA and Sub Rosa at the
application boundary rather than replacing either protocol.

## ACTA Team Review Checklist

Ask the ACTA team to verify:

1. the recommended production proof for credential type and issuer without
   retaining the full credential payload;
2. whether `VerifiedProviderCredential` should be replaced by an existing ACTA
   template or naming convention;
3. the intended holder/owner API-key handoff for third-party issuance;
4. whether the organizer or Sub Rosa application should own the outcome vault;
5. whether deterministic application credential IDs plus ACTA idempotency match
   their recommended retry strategy;
6. the minimal claim set for participation and selected-provider outcomes;
7. whether a share-link or selective-disclosure flow should replace direct
   `get-vc` in a production eligibility gate.
