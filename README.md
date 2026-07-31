<p align="center">
  <img src="./assets/sub-rosa-readme.png" width="250" alt="Sub Rosa logo" />
</p>

# Sub Rosa

**Embeddable sealed-auction infrastructure for Stellar.** Bidders lock Stellar
assets and submit bids that remain unreadable until a public Drand round. The
Soroban contract then verifies the reveal and atomically exchanges the winning
payment for the auction lot while refunding losing escrow.

Sub Rosa is a protocol and integration stack, not only a hosted application:

- a Soroban round contract with on-chain Drand BLS12-381 verification;
- a public TypeScript SDK with high-level partner templates;
- a tlock package for deterministic sealed payloads;
- a permissionless keeper for reveal and settlement;
- a hosted pilot UI and public receipts.

The primary economic use case is an **asset-backed sealed auction**. A second
`ReceiptOnly` template supports partners that need confidential proposals and a
verifiable simultaneous reveal without putting funds in escrow.

Licensed under [MIT](./LICENSE).

## Core v2 modes

| Mode | Intended use | Settlement |
| --- | --- | --- |
| `Auction` | High-value assets, collectibles, access rights, or other Stellar-native lots | Winner payment to seller and lot to winner in one settlement |
| `ReceiptOnly` | Confidential proposal collection and design-partner pilots | No asset movement; canonical reveal receipt only |

Both modes use the same versioned payload envelope, Drand reveal gate,
permissionless lifecycle, public read surface, and deterministic receipt model.
New partner workflows should be expressed as typed templates over these reviewed
modes rather than custom settlement callbacks.

## Public SDK

```bash
npm install @sub-rosa/sdk
```

The SDK includes the tlock and generated contract packages as versioned runtime
dependencies. Integrators normally need only the SDK:

```ts
import {
  createAssetAuctionRound,
  sealAssetBid,
  SubRosaClient,
} from "@sub-rosa/sdk";

const client = new SubRosaClient({
  rpcUrl,
  networkPassphrase,
  contractId,
  secretKey,
});

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

See [packages/sdk/README.md](./packages/sdk/README.md) for both integration
templates and [docs/INTEGRATION.md](./docs/INTEGRATION.md) for lifecycle,
preflight, keeper, and deployment guidance.

## Lifecycle

```text
Create round
    -> submit sealed payload and optional escrow
    -> wait for Drand round R
    -> permissionless open and reveal
    -> deterministic clear
    -> atomic settle or receipt-only completion
    -> public receipt
```

If reveal cannot complete, the contract exposes a grace-period void path that
returns held assets. The operator cannot decrypt submissions before `R` and
does not control who is allowed to advance the lifecycle after `R`.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system boundaries and
[docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) for residual risks.

## Verified artifacts

### Core v2 testnet

| Field | Value |
| --- | --- |
| Contract | [`CCZBS4N2CHRDIFRTPBVQHAH5JJLPZIXLG7EY3T7KP7Z6YERTUCBMYN4P`](https://stellar.expert/explorer/testnet/contract/CCZBS4N2CHRDIFRTPBVQHAH5JJLPZIXLG7EY3T7KP7Z6YERTUCBMYN4P) |
| WASM hash | `c6eb47b06b95f612361596944ce39f0545d3b11d93678952cef67dec09cce91e` |
| Proposal proof | Round `4` - `ReceiptOnly` - settled with canonical payload envelope |
| Atomic auction proof | Round `5` - `20 SRUSD` to seller and `1 SRLOT` to winner |

### Mainnet protocol proof

| Field | Value |
| --- | --- |
| Contract | [`CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX`](https://stellar.expert/explorer/public/contract/CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX) |
| Round | `1` - settled |
| Asset | Native XLM SAC |
| Scope | Legacy v1 settlement smoke, not a Core v2 production deployment |

Core v2 is testnet software. Funds-handling contracts require independent review
before a production or uncapped mainnet integration.

## Monorepo

```text
contracts/round/          Soroban sealed-round contract
packages/round-bindings/ Generated TypeScript contract bindings
packages/tlock/          Drand tlock and auditor encryption
packages/sdk/            Public integration SDK and templates
services/keeper/         Permissionless lifecycle automation
services/auction-template/ Reference auction integration
apps/web/                 Hosted pilot and receipt UI
docs/                     Current technical and partner documentation
```

## Development

Requirements: Node.js 22+, pnpm 10.13.1, Rust, and Stellar CLI for contract
builds.

```bash
pnpm install
pnpm contract:test
pnpm tlock:test
pnpm bindings:test
pnpm sdk:test
pnpm sdk:typecheck
pnpm packages:build
pnpm packages:pack
pnpm web:build
```

Live network scripts require explicit Stellar keys and configuration. Read
[docs/DEPLOY.md](./docs/DEPLOY.md) before running a value-moving command.

## Partner readiness

The software is ready for repeatable testnet pilots when a partner can use a
hosted link or the SDK without a protocol rewrite. Product evidence is a
separate milestone and must include external participants, public round IDs,
partner feedback, and a written next-step decision.

The project does not describe an interested team as a completed pilot and does
not describe testnet settlement as audited production usage. See
[docs/PLATFORM_PLAN.md](./docs/PLATFORM_PLAN.md) and
[docs/PILOT_PLAYBOOK.md](./docs/PILOT_PLAYBOOK.md).

## Documentation

| Document | Purpose |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Components, lifecycle, trust boundaries, and storage |
| [docs/INTEGRATION.md](./docs/INTEGRATION.md) | SDK, templates, preflight, keeper, and deployment flow |
| [docs/PLATFORM_PLAN.md](./docs/PLATFORM_PLAN.md) | Partner-ready product scope and remaining gates |
| [docs/PILOT_PLAYBOOK.md](./docs/PILOT_PLAYBOOK.md) | Design-partner and economic-pilot evidence plan |
| [docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md) | Cryptography, Core v2 modes, and settlement rails |
| [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) | Adversaries, mitigations, and residual risks |
| [docs/RECEIPTS.md](./docs/RECEIPTS.md) | Receipt schema and offline verification limits |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Runtime configuration and secret handling |
| [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) | Current network and production boundaries |
| [docs/CI.md](./docs/CI.md) | Continuous-integration checks |
