# Core v2 Demo Script

Use the hosted pilot UI or run `pnpm web:dev` locally.

## 1. Start with the partner choice

Show the two reviewed templates:

- `Auction`: asset custody, sealed bids, and atomic settlement.
- `ReceiptOnly`: confidential proposals and simultaneous reveal without escrow.

Explain that partners configure a template instead of requesting a new
contract.

## 2. Show the sealed phase

Open a round before Drand `R` and show:

- public item reference and deadlines;
- participant count, open/allowlist policy, and shared fixed escrow where applicable;
- ciphertext instead of readable bid/proposal content;
- public status without requiring a wallet.

## 3. Show permissionless reveal

After `R`, show the keeper or another account submitting the Drand signature.
The contract verifies BLS12-381 on-chain and accepts only payloads matching their
original commitments.

## 4. Show completion

For an auction, show the two atomic asset movements:

```text
winner payment -> seller
auction lot    -> winner
```

Then show unused and losing escrow refunds.

For a proposal round, show the revealed price, timeline, and approach fields and
make clear that partner selection remains off-chain.

## 5. Show the receipt

Display the contract ID, round ID, network, schema, participant count, final
status, policy, revealed payloads, winner when applicable, and settlement indicators.
Mention that SDK receipt verification is offline and should be combined with a
direct ledger query for high-value use.

## 6. State the boundary

Core v2 has live testnet proofs. The mainnet artifact is a legacy v1 settlement
proof. Production mainnet use follows an independent funds-handling review.

## Verification commands

```bash
pnpm contract:test
pnpm sdk:test
pnpm keeper:test
pnpm web:test
pnpm web:build
```
