# Sub Rosa Architecture

Sub Rosa is a sealed-round protocol for Stellar applications. Its primary mode
atomically settles asset-backed sealed auctions; its receipt-only mode supports
confidential structured submissions without asset custody.

For cryptographic and settlement detail, see
[docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md).

## System map

```text
Partner application or hosted pilot
        |
        | @sub-rosa/sdk templates and public reads
        v
Sub Rosa Round contract (Soroban)
  - versioned payload commitments
  - Drand BLS12-381 reveal gate
  - Auction or ReceiptOnly mode
  - deterministic clear, settle, refund, and void
        ^
        |
        | permissionless lifecycle operations
Keeper service ---------------------- Drand quicknet
        |
        +-- status API and public receipt data

Participant browser/backend
  - @sub-rosa/tlock seal
  - local wallet signature
  - no signing secret sent to Sub Rosa services
```

## Core v2 lifecycle

| Phase | Actor | Contract behavior |
| --- | --- | --- |
| Create | Organizer/seller | Stores mode, schema, deadlines, assets, and Drand round; takes lot custody for auctions |
| Submit | Participant | Stores commitment, ciphertext, auditor blob, and allowed escrow |
| Wait | Nobody | Payload remains unreadable before Drand round `R` |
| Open | Anyone | Submits round-`R` signature; contract verifies BLS12-381 on-chain |
| Reveal | Anyone | Opens payload and verifies its canonical commitment |
| Clear | Anyone | Applies the reviewed selection rule |
| Complete | Anyone | Atomically settles auction assets or finalizes a receipt-only round |
| Void | Anyone after grace | Returns held assets when the lifecycle cannot complete |

The operator does not have an early-decryption key and does not receive special
authority to advance the lifecycle after the deadlines.

## Modes

### Auction

The seller deposits a lot at creation. Bidders deposit payment caps with sealed
bids. Settlement transfers the winning amount to the seller and the lot to the
winner, then refunds unused and losing escrow.

```text
seller lot -> contract -> winner
winner escrow -> contract -> seller + winner refund
loser escrow -> contract -> each loser
```

### ReceiptOnly

Participants submit sealed structured payloads with zero escrow. The contract
produces a verifiable revealed set and completion state. Business selection and
any later payment remain outside the contract.

## Components

| Path | Responsibility |
| --- | --- |
| `contracts/round/` | Soroban state machine, Drand verification, custody, settlement, refunds |
| `packages/round-bindings/` | Generated TypeScript client and spec-accurate types |
| `packages/tlock/` | Payload sealing/opening and auditor identity encryption |
| `packages/sdk/` | Partner templates, client, preflight, receipts, and status reads |
| `services/keeper/` | Permissionless lifecycle automation and health API |
| `services/auction-template/` | Reference native SDK integration |
| `apps/web/` | Hosted pilot, public round, and receipt views |
| `services/agent/` | Optional autonomous bidder proof and mandate checks |
| `services/appraisal-api/` | Optional x402 appraisal proof; not required by Core v2 |

## Trust boundaries

| Component | Trusted for | Not trusted for |
| --- | --- | --- |
| Round contract | Commitments, custody, mode rules, settlement and void | Off-chain business decisions or unaudited extensions |
| Drand | Publishing the future threshold signature | Application liveness if no keeper acts |
| Organizer | Round configuration and item description | Early payload access or discretionary settlement |
| Keeper | Timely lifecycle execution | Early decryption or changing the winner |
| SDK/tlock client | Canonical encoding and local sealing | Protecting a compromised participant device |
| Auditor | Identity recovery with its secret key | Reading the sealed application payload before `R` |

Full adversary analysis: [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md).

## Storage

| Tier | Contents | Lifetime |
| --- | --- | --- |
| Instance | Drand configuration and round counter | Contract lifetime with TTL extension |
| Persistent | Round, participant state, escrow, result, settlement flags | Through completion/void and retention window |
| Temporary | Ciphertext and auditor blob | Through reveal deadline plus observer buffer |

The contract extends seal TTL from the configured reveal deadline. Settlement
uses validated persistent state and does not depend on expired ciphertext.

## Integration paths

| Path | Partner code change | Best use |
| --- | --- | --- |
| Hosted pilot | None or a link | First design review and external test |
| SDK template | Small TypeScript integration | Partner-owned UX and wallet flow |
| Low-level bindings | Advanced | Custom monitoring and operations around reviewed modes |

All signing stays in the partner application or participant wallet. The keeper
and hosted read surfaces require no participant secret keys.

## Public package graph

```text
@sub-rosa/sdk
  -> @sub-rosa/tlock
  -> @sub-rosa/round-bindings
       -> @stellar/stellar-sdk
```

Packages ship compiled ESM and TypeScript declarations. The generated bindings
are checked against contract WASM in CI.

## Network proofs

| Network | Artifact | Meaning |
| --- | --- | --- |
| Testnet | Core v2 contract `CCZBS4N2CHRDIFRTPBVQHAH5JJLPZIXLG7EY3T7KP7Z6YERTUCBMYN4P` | ReceiptOnly round 4 and atomic Auction round 5 settled |
| Mainnet | Legacy v1 contract `CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX` | Real XLM settlement proof only |

Core v2 requires independent funds-handling review before production mainnet
use.

## Related documentation

| Document | Focus |
| --- | --- |
| [docs/INTEGRATION.md](./docs/INTEGRATION.md) | SDK and partner integration |
| [docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md) | Cryptography and settlement |
| [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) | Adversaries and residual risks |
| [docs/RECEIPTS.md](./docs/RECEIPTS.md) | Receipt schema and verification |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Runtime configuration and secrets |
| [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) | Current production boundary |
