# `@sub-rosa/sdk`

Public TypeScript client for Sub Rosa sealed auctions and receipt-only proposal
rounds on Stellar.

## Install

```bash
npm install @sub-rosa/sdk
```

The package ships compiled ESM and TypeScript declarations. Node.js 22 or newer
is supported. Browser applications should provide the wallet/signing adapter
used by their Stellar stack.

## Network configuration

Use a named network preset for the canonical deployment:

```ts
import { SubRosaClient } from "@sub-rosa/sdk";

const client = new SubRosaClient({
  network: "testnet",
  publicKey: process.env.STELLAR_PUBLIC_KEY,
});
```

`network: "mainnet"` selects the official Core v2 deployment on the Stellar
public network. An explicit `contractId` is still accepted for a caller-owned
reviewed deployment:

```ts
const client = new SubRosaClient({
  network: "mainnet",
  secretKey: process.env.STELLAR_SECRET_KEY,
});
```

Browser integrations pass their wallet source and Freighter-compatible signing
callbacks instead of a secret key:

```ts
const client = new SubRosaClient({
  network: "mainnet",
  publicKey: walletAddress,
  signTransaction: wallet.signTransaction,
  signAuthEntry: wallet.signAuthEntry,
});
```

The legacy v1 mainnet proof is never selected as a Core v2 default. Custom RPCs
remain supported with `rpcUrl`; custom networks can continue to provide the
full `rpcUrl`, `networkPassphrase`, and `contractId` tuple.

On the first contract call, the client asks the RPC for its actual network
passphrase and confirms that `contractId` exists on that network. The result is
cached for later calls. A mismatch throws `SubRosaNetworkMismatchError` before
simulation, signing, or submission, with the conflicting values and a suggested
fix. Contract IDs do not encode a Stellar network, so copying a `C...` address
between Testnet and Mainnet requires updating all three configuration values.

## Fees and signing

The SDK does not charge fees to Sub Rosa. Each state-changing call is paid by
the transaction source that signs it: the seller pays create/settle calls, each
bidder pays its submission, and a keeper pays lifecycle calls it submits.
Escrow and lot assets are contract value, separate from Stellar network fees.
An optional relayer may sponsor fees, in which case the relayer operator pays.
Read-only simulation and receipt verification do not submit transactions.

Successful writes are available as `client.submittedTransactionHashes`, which
lets integrations preserve explorer evidence without parsing logs.

## Core v2 partner templates

Core v2 keeps one sealed-round lifecycle and exposes two reviewed templates.
`ReceiptOnly` is suitable for a design-partner proposal pilot and never moves
assets. `Auction` requires payment and lot SAC addresses, takes the lot into
custody when the round is created, and exchanges payment for the lot atomically
at settlement.

Both helpers create contract-enforced partner rounds. Pass
`eligibleParticipants` to restrict commits to a known cohort, or omit it for an
open round. Auction rounds require `fixedEscrow`; every bidder must lock exactly
that amount.

```ts
import {
  createSealedProposalRound,
  generateAuditorKeypair,
  quicknet,
  roundInSeconds,
  sealProposal,
} from "@sub-rosa/sdk";

const drand = quicknet();
const revealRound = await roundInSeconds(drand, 5 * 60);
const auditor = generateAuditorKeypair();

const roundId = await createSealedProposalRound(client, {
  itemRef,
  revealRound,
  commitDeadline,
  revealDeadline,
  auditorPubkey: auditor.publicKey,
  eligibleParticipants: [providerA, providerB], // optional
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

An asset auction uses the same reveal and keeper infrastructure, but makes
custody explicit at creation:

```ts
import { createAssetAuctionRound, sealAssetBid } from "@sub-rosa/sdk";

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

await client.submitV2({ roundId, sealed, escrow: 1_000n }); // exact fixed escrow
```

The creating wallet must hold and authorize transfer of `lotAmount`. Bidders
must hold and authorize the round's fixed escrow. The SDK preflight methods can
simulate every state-changing call before signing.

## Low-level packages

`@sub-rosa/sdk` exposes the complete partner integration surface and installs
compatible `@sub-rosa/tlock` and `@sub-rosa/round-bindings` versions
automatically. Install either package directly only when building custom
cryptography, indexing, or contract tooling.

## Security boundary

The SDK validates configuration and canonical payloads, but it cannot make an
unknown contract deployment trustworthy. Production applications should pin a
reviewed network, contract ID, and WASM hash. Core v2 has testnet proofs and an
official capped-mainnet deployment. It requires independent funds-handling
review before uncapped mainnet use.
