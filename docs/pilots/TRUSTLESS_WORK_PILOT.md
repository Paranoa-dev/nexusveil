# Sub Rosa x Trustless Work Pilot

Route: `#/pilot/trustless-work`

Status: testnet integration pilot. This is not a production deployment or a
protocol redesign.

## Purpose

This pilot demonstrates the agreed Trustless Work handoff:

1. Sub Rosa collects private provider proposals through `ReceiptOnly`.
2. No price, timeline, approach, deliverable, or milestone plan is public before
   the configured deadline and Drand reveal.
3. After reveal, the organizer manually selects one proposal.
4. The selected proposal is converted into a Trustless Work multi-release
   escrow configuration.
5. Trustless Work creates, funds, and manages milestone escrow state on testnet.

Trustless Work confirmed this pilot/integration flow and confirmed support for
different receivers per milestone. The pilot may mention Trustless Work as a
pilot/integration partner at that commitment level.

## Responsibility Boundary

Sub Rosa remains responsible for:

- confidential competitive proposal collection;
- deadline and Drand reveal lifecycle;
- the canonical Sub Rosa round receipt;
- exposing the selected proposal after organizer selection.

Trustless Work remains responsible for:

- escrow creation;
- multi-release milestone structure;
- funding;
- milestone and payment execution;
- escrow state and events.

The Core v2 contract is unchanged. Trustless Work integration lives in the web
pilot layer and uses ReceiptOnly structured payloads from `@sub-rosa/sdk`.

## User Flow

The route seeds a realistic software RFP:

- project: "Build a Stellar merchant analytics dashboard";
- budget: up to 2,000 USDC;
- three sample providers;
- proposal fields: total amount, timeline, approach, team metadata,
  deliverables, and milestones.

The seeded winning-style proposal totals 1,500 USDC:

| Milestone | Amount | Receiver |
| --- | ---: | --- |
| UI / dashboard implementation | 400 USDC | provider wallet A |
| Stellar data integration | 700 USDC | provider wallet A |
| Security / final review | 400 USDC | provider wallet B |

Sample mode is UI-only and never claims real Sub Rosa or Trustless Work
transactions. Live mode creates and reveals a real Core v2 `ReceiptOnly` round.
Trustless Work actions require a configured API key and a connected Freighter
wallet.
The pilot preloads the canonical testnet USDC contract ID so the escrow form
starts from a working default.

## Trustless Work Integration

The web adapter uses the current Trustless Work v2 REST flow:

| Step | Endpoint |
| --- | --- |
| Build multi-release deploy transaction | `POST /escrow/multi-release/v2/deploy` |
| Submit signed transaction | `POST /stellar/send-transaction` |
| Build fund transaction | `POST /escrow/multi-release/v2/fund` |
| Read escrow state | `GET /escrows/{contractId}` |

Deploy and fund endpoints return unsigned XDR. The pilot signs that XDR locally
with Freighter and submits the signed XDR through Trustless Work's
`/stellar/send-transaction` endpoint. The UI only displays escrow IDs,
contract IDs, and tx hashes returned by Sub Rosa or Trustless Work responses.
It does not fabricate identifiers.

The generated Trustless Work deploy payload contains:

- `signer`;
- `engagementId`, derived from the Sub Rosa round ID when available;
- project `title` and `description`;
- Trustless Work `roles`;
- `platformFee`;
- `milestones[]` with `description`, `amount`, and milestone-specific
  `receiver`;
- `trustline`.

Trustless Work-specific validation stays in `apps/web/src/integrations`, not in
Sub Rosa Core.

## Environment

For local web testing, copy `apps/web/.env.example` to `apps/web/.env.local`
and set:

```bash
VITE_TRUSTLESS_WORK_BASE_URL=https://beta.api.trustlesswork.com
VITE_TRUSTLESS_WORK_API_KEY=
VITE_TRUSTLESS_WORK_TRUSTLINE_CONTRACT_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
VITE_TRUSTLESS_WORK_TRUSTLINE_SYMBOL=USDC
VITE_TRUSTLESS_WORK_TRUSTLINE_ADDRESS=
```

`VITE_TRUSTLESS_WORK_API_KEY` is required for real Trustless Work requests.
It must be a Core v2 beta Testnet key for `https://beta.api.trustlesswork.com`;
Version 1 `dev.api`/`api` keys are not interchangeable with the beta Core API.
Trustline values can be edited in the pilot UI before deploy.

The Sub Rosa live path also requires the normal Core v2 web config:

```bash
VITE_STELLAR_NETWORK=testnet
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_CONTRACT_ID=
```

## Evidence

The final pilot receipt panel links:

- Sub Rosa network and `ReceiptOnly` round ID;
- participant count and reveal state;
- selected provider and selected proposal amount;
- Trustless Work base URL;
- Trustless Work escrow contract ID, when returned;
- deployment tx hash, when submitted;
- funding tx hash, when submitted;
- milestone preview or returned escrow milestone state.

Sub Rosa verifies the sealed proposal process. The organizer makes the business
selection. Trustless Work verifies and executes milestone escrow state after
the selected proposal is handed off.

## Success Criteria

- At least three providers can submit sealed proposals.
- No confidential proposal fields are readable before reveal.
- Reveal exposes the proposal fields through the existing ReceiptOnly boundary.
- The organizer can select a winner without claiming deterministic protocol
  winner selection.
- The selected milestone plan maps into a Trustless Work multi-release escrow
  payload, including different receivers per milestone.
- A real Trustless Work testnet escrow can be created and funded when valid
  Trustless Work credentials, trustline data, and wallet signatures are
  available.
- The combined receipt shows only real returned IDs and tx hashes.

## Non-goals

- No Trustless Work logic is added to the Sub Rosa Core v2 contract.
- No production funds are expected.
- No milestone release workflow is reimplemented in Sub Rosa.
- No fake escrow IDs, contract IDs, transaction hashes, or response shapes are
  displayed.
