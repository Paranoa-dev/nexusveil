# Partner-Ready Platform Plan

## Objective

Sub Rosa should let a Stellar project run a credible testnet pilot through a
hosted flow or a small SDK integration. A partner should configure a reviewed
template, not request a protocol fork.

The product has one primary economic wedge and one supporting integration mode:

- **Primary:** asset-backed sealed auctions with atomic payment-for-lot
  settlement.
- **Supporting:** receipt-only confidential proposals with verifiable
  simultaneous reveal and no asset custody.

This keeps the economic case focused while making the underlying protocol
reusable across partners with different engineering capacity.

## Integration levels

| Level | Partner effort | Sub Rosa surface |
| --- | --- | --- |
| Hosted pilot | No production code change | Public pilot URL and receipt |
| Embedded experience | Small UI or routing change | Hosted round flow linked from partner product |
| Native integration | Product-controlled UX | `@sub-rosa/sdk` template APIs |
| Operations integration | Backend automation | Keeper status API and public round reads |

Wallet signatures and encryption remain client-side. Sub Rosa services must
never receive participant secret keys.

## Reviewed templates

| Template | Payload | Settlement | Partner profile |
| --- | --- | --- | --- |
| Asset auction | Amount and item reference | Winner payment to seller; lot to winner | Marketplace, issuer, game, collectible, tokenized asset |
| Sealed proposal | Price, timeline, approach | Receipt only | Service marketplace or procurement discovery flow |

Additional templates may be added only when a concrete partner workflow needs
them. New funds-handling behavior requires contract review and tests; it is not
implemented through arbitrary callbacks.

## Completion gates

### Protocol

- Versioned payloads bind the complete submission.
- Drand signatures are verified on-chain before reveal.
- Auction settlement conserves payment and lot assets across settle and void.
- Supported participant and duration limits are explicit.
- Core v2 contract tests cover happy paths and funds-return failure paths.

### SDK

- Public ESM packages contain compiled JavaScript and declarations.
- High-level auction and proposal templates hide raw contract argument wiring.
- Package tarballs install and import in a clean external project.
- Public reads do not require a wallet or secret key.
- Mutating operations expose preflight simulation and typed errors.

### Hosted pilot

- A partner can open a testnet round without changing production code.
- Participants can submit, follow status, and verify the final receipt.
- Keeper health and lifecycle state are visible.
- The hosted service never accepts signing secrets.

### External evidence

- One design partner completes a receipt-only proposal pilot.
- One economic partner completes an atomic asset-auction pilot.
- Each pilot includes external participants, public round IDs, and feedback.
- The economic pilot reports escrow, settlement, and refund results.
- A qualified independent reviewer evaluates funds-handling paths before a
  production mainnet launch.

## Delivery order

1. Publish and independently install-test the SDK packages.
2. Run the hosted `ReceiptOnly` flow with a design partner.
3. Run an `Auction` flow with an asset marketplace or issuer.
4. Publish pilot receipts, integration effort, failures, and partner decisions.
5. Complete an external contract review.
6. Resolve findings and define a capped mainnet beta.

## Outcome metrics

Engineering output alone is not adoption evidence. Track:

- time and code required for partner integration;
- number of external participants and completed rounds;
- total escrow and settled value for auction pilots;
- refund correctness and lifecycle failures;
- partner feedback and go/no-go decisions;
- repeat-round or production-integration intent;
- external review findings and resolutions.

## Current boundary

Core v2 has public testnet proofs for both templates and a hash-pinned capped
mainnet deployment. The legacy v1 settlement proof remains historical evidence;
the Core v2 mainnet address is now canonical. No document should describe Core
v2 as audited or production-ready until an independent funds-handling review is
complete.
