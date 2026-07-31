# `@sub-rosa/sdk`

TypeScript client for reading and submitting Sub Rosa Round contract calls.

## Network configuration

Configure the RPC URL, network passphrase, and contract ID from the same deployment:

```ts
import { SubRosaClient } from "@sub-rosa/sdk";

const client = new SubRosaClient({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contractId: process.env.ROUND_CONTRACT_ID!,
  publicKey: process.env.STELLAR_PUBLIC_KEY,
});
```

On the first contract call, the client asks the RPC for its actual network
passphrase and confirms that `contractId` exists on that network. The result is
cached for later calls. A mismatch throws `SubRosaNetworkMismatchError` before
simulation, signing, or submission, with the conflicting values and a suggested
fix. Contract IDs do not encode a Stellar network, so copying a `C...` address
between Testnet and Mainnet requires updating all three configuration values.

## Core v2 partner templates

Core v2 keeps one sealed-round lifecycle and exposes two reviewed templates.
`ReceiptOnly` is suitable for a design-partner proposal pilot and never moves
assets. `Auction` requires payment and lot SAC addresses, takes the lot into
custody when the round is created, and exchanges payment for the lot atomically
at settlement.

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

The creating wallet must hold and authorize transfer of `lotAmount`. Bidders
must hold and authorize their public escrow cap. The SDK preflight methods can
simulate every state-changing call before signing.
