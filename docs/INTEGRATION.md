# Integrating Sub Rosa

Sub Rosa can be used through a hosted pilot or embedded through the public
TypeScript SDK. The contract, SDK, keeper, and receipt format are shared across
the reviewed templates.

## Install

```bash
npm install @sub-rosa/sdk
```

`@sub-rosa/sdk` exposes the complete partner integration surface, including
Drand timing, seal/open helpers, auditor keys, and generated contract types. It
depends on version-matched releases of `@sub-rosa/tlock` and
`@sub-rosa/round-bindings`; install those packages directly only when building
custom low-level cryptography or contract tooling.

## Client configuration

```ts
import { SubRosaClient } from "@sub-rosa/sdk";

const client = new SubRosaClient({
  network: "testnet",
  publicKey: process.env.STELLAR_PUBLIC_KEY,
});
```

For Core v2 mainnet, switch to `network: "mainnet"` to use the canonical
deployment. An explicit reviewed `contractId` can still override the preset;
the legacy v1 mainnet proof is not a Core v2 default.

The first contract operation checks the RPC network passphrase and verifies
that the contract exists on that network. A configuration mismatch fails before
simulation, signing, or submission.

The account signing each write pays that Stellar transaction's fee. The SDK
never draws fees from a Sub Rosa account. A seller, bidder, or keeper therefore
pays only the calls it submits unless an application explicitly configures a
fee-sponsoring relayer. Contract escrow is separate from network fees.

## Asset auction

Use `Auction` when the round must atomically exchange a payment asset for a lot
asset.

```ts
import {
  createAssetAuctionRound,
  quicknet,
  sealAssetBid,
  SubRosaClient,
} from "@sub-rosa/sdk";

const drand = quicknet();

const roundId = await createAssetAuctionRound(client, {
  itemRef,
  paymentAsset: usdcSac,
  lotAsset: collectibleSac,
  lotAmount: 1n,
  fixedEscrow: 1_000n,
  revealRound,
  commitDeadline,
  revealDeadline,
  auditorPubkey,
});

const sealed = await sealAssetBid({
  round: Number(revealRound),
  drand,
  amount: 700n,
});

await client.submitV2({ roundId, sealed, escrow: 1_000n });
```

The seller authorizes lot custody at round creation. Every bidder authorizes the
same contract-enforced `fixedEscrow` when submitting. Settlement transfers the winning amount to the
seller, returns the winner's unused escrow, refunds losers, and transfers the
lot to the winner.

## Sealed proposal

Use `ReceiptOnly` when a partner needs confidential structured proposals and a
verifiable simultaneous reveal without asset custody.

```ts
import {
  createSealedProposalRound,
  sealProposal,
} from "@sub-rosa/sdk";

const roundId = await createSealedProposalRound(client, {
  itemRef,
  revealRound,
  commitDeadline,
  revealDeadline,
  auditorPubkey,
  eligibleParticipants: [providerA, providerB], // optional; omit for open access
});

const sealed = await sealProposal({
  round: Number(revealRound),
  drand,
  price: 2_500n,
  proposal: {
    timelineDays: 14,
    approach: "manual and automated Soroban review",
  },
});

await client.submitV2({ roundId, sealed, escrow: 0n });
```

The partner remains responsible for comparing proposals and choosing a provider.
The round proves the submission set and reveal timing; it does not claim to
make the business decision on-chain.

## Preflight

Every state-changing Core v2 operation has a matching preflight method. Use it
before asking a wallet to sign:

```ts
const result = await client.preflightSubmitV2({
  roundId,
  sealed,
  escrow,
});

if (!result.ok) {
  console.error(result.error.kind, result.error.message);
  return;
}

await client.submitV2({ roundId, sealed, escrow });
```

Use `preflightCreatePartnerRoundV2` for partner-round creation. The lower-level
`createRoundV2` remains available only for compatibility with earlier Core v2
integrations; new integrations should use the templates or
`createPartnerRoundV2` directly.

Preflight results expose transaction fee estimates, Soroban resources, typed
RPC failures, and decoded contract errors where available.

## Read-only access

Public round state does not require a wallet. Configure `SubRosaClient` without
a secret key and use round reads or the keeper status client for partner UI,
monitoring, and receipt pages.

## Keeper

After Drand round `R`, any account can advance the permissionless lifecycle.
Production pilots should still run a keeper for predictable liveness:

```bash
pnpm keeper:watch
```

The keeper opens reveal, submits each valid payload with retry-safe per-bidder
calls, clears the round, settles or
completes it, and exposes health/status data. It cannot decrypt payloads before
Drand publishes `R` and does not need participant secret keys.

## Errors and receipts

- Contract errors: [contracts/round/ERRORS.md](../contracts/round/ERRORS.md)
- Receipt schema: [RECEIPTS.md](./RECEIPTS.md)
- Threat model: [THREAT_MODEL.md](./THREAT_MODEL.md)
- Current production limits: [LIMITATIONS.md](./LIMITATIONS.md)

Receipt verification is offline and checks internal consistency. Applications
that need ledger provenance should also query the configured contract and
network directly.
