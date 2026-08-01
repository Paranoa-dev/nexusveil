# Security and lifecycle checks

Load this reference for design review, test planning, incident handling, or any
funds-handling integration.

## Invariants

- Bind ciphertext to the intended Drand round and canonical payload envelope.
- Use `now < commitDeadline < time(R) < revealDeadline`.
- Use the same non-zero `fixedEscrow` for every Auction bidder.
- Require private bid amount `<= fixedEscrow`.
- Require `escrow: 0n` and no settlement assets for ReceiptOnly.
- Cap participants at the contract-supported limit; partner templates default
  to bounded cohorts and reject invalid values before RPC.
- Treat the public eligibility list as an allowlist, not private identity, KYC,
  or reputation.
- Pin RPC, passphrase, contract ID, and reviewed WASM hash as one deployment.

## Permissionless does not mean automatic

Any account may advance the round after Drand publishes `R`, but an external
caller must still do so. Run at least one keeper and alert on:

- Drand round published but reveal not opened;
- unrevealed participants after `openRevealV2`;
- reveal deadline passed but round not cleared;
- cleared Auction not settled;
- grace period reached but recovery not executed.

Reveals are separate bounded transactions. One failed or malformed submission
must not block processing of other participants. Retry by reading durable state
and skipping completed actions.

## Recovery

Use `voidV2` only when the contract's grace path permits it. Preflight first,
then verify that Auction escrow and lot custody are returned according to the
round state. Preserve the void receipt and transaction hashes.

Do not create an operator-only emergency reveal or settlement path. The
operator configures the round but should not gain early decryption or exclusive
lifecycle authority.

## Receipt boundary

`verifyReceiptV2` recomputes canonical payload commitments and deterministic
winner selection from the receipt. It does not connect to Stellar and therefore
cannot prove that an exporter copied current ledger state honestly. For higher
assurance:

1. Export after terminal settlement or void.
2. Query the pinned contract and network directly.
3. Export independently from more than one client and compare.
4. Store transaction hashes with the canonical receipt.

## Current assurance statement

Core v2 has settled testnet proofs. It has not received an independent
funds-handling audit. The legacy v1 mainnet settlement is protocol evidence,
not a Core v2 production deployment. Keep pilots on testnet with explicit
participant and value caps until deployment review, operational monitoring,
and an independent audit are complete.
