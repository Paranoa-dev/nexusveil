# Integrating Sub Rosa

Sub Rosa does not require users to come to the Sub Rosa demo app. The demo app
is a showcase. The intended product surface is a Soroban contract plus
TypeScript packages that auction and competitive-bid apps can embed.

## Target integration

```bash
npm install @sub-rosa/sdk @sub-rosa/tlock
```

`@sub-rosa/sdk` is already present in this monorepo as `packages/sdk`. Publishing
to npm is a release step, not a protocol requirement.

## What an app integrates

An integrating app usually needs four pieces:

| Piece | Role |
| --- | --- |
| Round contract | Stores commitments, ciphertext, escrow, deadlines, Drand R, reveal state |
| `@sub-rosa/sdk` | Creates rounds and submits contract calls from app backend/frontend |
| `@sub-rosa/tlock` | Seals values to Drand R and opens ciphertext after R |
| Keeper | Opens reveal and settles when Drand R is live; permissionless by design |

## Minimal flow

```ts
import { SubRosaClient } from "@sub-rosa/sdk";
import { generateNonce, quicknet, sealBid } from "@sub-rosa/tlock";

const drand = quicknet();
const client = new SubRosaClient({
  rpcUrl,
  networkPassphrase,
  contractId,
  secretKey,
});

const sealed = await sealBid({
  value,
  nonce: generateNonce(),
  round: revealRound,
  client: drand,
  identity,
  auditorPublicKey,
});

await client.commit({
  roundId,
  sealed,
  escrow,
});
```

After Drand round `R` is published, any keeper or participant can submit the
Drand signature, reveal valid bids, clear the auction, pay the operator from
winner escrow, and refund losing escrow.

## Primary use case

The focused integration target is an escrow-backed sealed auction:

- bids remain unreadable before close;
- the winning bid is paid from escrow;
- losers are refunded deterministically;
- the operator cannot read bids early or choose who settles;
- the final receipt is public and verifiable.

Future templates can adapt the same primitive to grants, judging, RFPs, DAO
polls, or allocation workflows, but those do not lead the current SCF
resubmission.

## Hosted vs embedded

| Mode | Who uses it | Notes |
| --- | --- | --- |
| Embedded SDK | Stellar app developers | App owns UI and user flow |
| Hosted keeper | Apps that want liveness without running ops | Keeper cannot read early values; it only opens after R |
| Demo frontend | Reviewers, pilots, onboarding | Shows the primitive working end-to-end |

## Trust model

Sub Rosa does not ask integrators to trust a reveal operator. Before Drand R,
values are timelock-encrypted. After R, the Drand BLS signature is public and
the Soroban contract verifies it before opening reveal.
