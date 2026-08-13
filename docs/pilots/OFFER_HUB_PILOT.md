# Offer-Hub x Sub Rosa Pilot

Route: `#/pilot/offer-hub`

Status: optional sealed-proposal pilot workflow. This is not an Offer-Hub
production integration or deployment.

## Purpose

Validate Sub Rosa as an optional sealed-proposal layer for the part of a
freelancer marketplace where several providers compete for one posted job.
Offer-Hub's fixed-price listing flow is outside this pilot and does not need
Sub Rosa.

The pilot is standalone, but its live mode uses the existing Sub Rosa Core v2
contract, SDK proposal schema, tlock encryption, Drand reveal lifecycle, and
canonical receipt export.

## Flow

```text
Offer-Hub-style job
  -> optional Private / Sealed Proposals
  -> private freelancer submissions
  -> shared deadline and Drand reveal
  -> client compares revealed proposals
  -> client manually selects a provider
```

The default job asks freelancers to build a Stellar merchant analytics
dashboard with a 2,000 USDC budget. Proposals include provider name, proposed
price, delivery time, short approach, relevant experience, and an optional
milestone summary.

## Responsibilities

Offer-Hub remains responsible for:

- marketplace discovery and fixed-price listings;
- freelancer identity and profiles;
- subscriptions and visibility;
- eligibility and business rules;
- job lifecycle and provider selection;
- payment, fulfillment, and disputes.

Sub Rosa is responsible only for:

- the sealed proposal round;
- proposal confidentiality before the deadline;
- the Drand-gated reveal lifecycle;
- the canonical round receipt and offline verification.

Sub Rosa provides the private proposal layer. Offer-Hub keeps its existing
marketplace and selection logic.

## Why ReceiptOnly

The lowest price is not necessarily the best freelancer proposal. Clients need
to compare experience, approach, timeline, milestones, and price before making
a business decision. Therefore the pilot uses the SDK's existing
`sealedProposalRound` template, which maps to Core v2 `ReceiptOnly` with zero
escrow.

Core v2 seals and reveals the complete proposal set but declares no economic
winner. The selected provider is application-level state stored by the pilot;
it never mutates or masquerades as the receipt's `winner` field.

## Demo vs Real Mode

Sample mode is a local marketplace simulation:

- the job and example Nova Labs, StellarCraft, and Orbit Studio proposals are
  demo data;
- proposal plaintext and reveal state are stored in browser `localStorage`;
- no contract ID, transaction hash, signature, or Sub Rosa receipt is claimed;
- local plaintext storage does not provide protocol confidentiality.

Live mode uses real configured Sub Rosa infrastructure:

- Freighter signs a real Core v2 `ReceiptOnly` round creation;
- the browser encrypts structured proposals with the existing
  `sealProposal` SDK helper;
- `commit_v2`, `open_reveal_v2`, `reveal_v2`, and `clear_v2` advance the normal
  contract lifecycle;
- displayed transaction hashes come only from signed Stellar responses;
- receipt export uses `exportReceiptV2`, `verifyReceiptV2`, and
  `serializeReceiptV2` from `@sub-rosa/sdk`.
- live proposal form plaintext is intentionally excluded from workspace
  `localStorage`; refreshing before submission discards that draft.

The canonical testnet deployment exposes the Core v2 partner-policy entrypoints.
This pilot creates an open-participation `ReceiptOnly` round with zero escrow
and no allowlist through the shared SDK template. Receipt export records the
enforced partner policy without assigning an economic winner.

The pilot is not connected to Offer-Hub APIs, databases, subscriptions,
payments, or production UI. Separate wallets or browsers are required to act
as multiple live providers. A copied route containing the numeric round ID can
be opened by each participant.

## Configuration

Live mode uses the normal web configuration in `apps/web/.env.local`:

```bash
VITE_STELLAR_NETWORK=testnet
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_CONTRACT_ID=CCOVGOQQZJKZ2R55GRWBLTJTGBAMSHXZVN3ICPG3WRVMLMM6RHISC5OV
```

Freighter must be installed, unlocked, and set to the same network. The wallet
pays Stellar network fees. `ReceiptOnly` does not escrow the proposed USDC
amount.

## Future Integration Path

A later Offer-Hub integration can preserve its normal client and freelancer
experience:

1. Add an optional `Private / Sealed Proposals` toggle to an Offer-Hub job.
2. Create a Sub Rosa `sealedProposalRound` behind the existing job page.
3. Encrypt and commit the existing proposal form through the Sub Rosa SDK.
4. Display only proposal count and sealed status before the shared deadline.
5. Reveal through the normal permissionless lifecycle.
6. Let the client select a provider using Offer-Hub's existing application
   logic, then continue into its normal payment and fulfillment flow.

No protocol rewrite is required. Offer-Hub-specific mapping and business rules
belong in an adapter at the application boundary.

## Evidence

The screenshot-friendly evidence panel distinguishes sample and live state and
shows:

- partner workflow: Offer-Hub;
- Sub Rosa mode: `ReceiptOnly`;
- proposal and reveal counts;
- selected provider as application-level state;
- configured contract and numeric round ID only in live mode;
- canonical receipt availability and verification status;
- no protocol winner for `ReceiptOnly`;
- only transaction hashes returned by Stellar.

For a shareable partner or SCF record, run a live testnet round with external
provider wallets and preserve the downloaded receipt plus linked transaction
hashes.

## Non-goals and Boundaries

- No changes are made to Sub Rosa Core v2 or its settlement rules.
- No fixed-price Offer-Hub flow is modeled.
- No Offer-Hub production integration is claimed.
- Offer-Hub subscriptions do not automatically become protocol eligibility.
- Sub Rosa does not choose the provider or process Offer-Hub payments.
- Sample proposals are never presented as on-chain evidence.
