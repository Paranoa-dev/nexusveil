# OpenX402 × Sub Rosa Pilot

Route: `#/pilot/openx402`

Status: sealed agent-bidding pilot with fixture-backed discovery, real optional
Sub Rosa `ReceiptOnly` execution, and a typed payment handoff. This is not an
official OpenX402 production integration.

## Purpose

Validate Sub Rosa as a lightweight sealed competition layer between service
discovery and x402 payment. The pilot tests whether several discovered providers
can submit private, resource-bound offers without requiring a full
LLM-to-LLM negotiation for every low-value API request.

Sub Rosa adds private competitive selection between discovery and payment
without replacing either system.

## Agreed Flow

```text
OpenX402 discovery
  -> Sub Rosa ReceiptOnly sealed offers
  -> Drand reveal and canonical receipt
  -> application validates and selects a provider
  -> OpenX402 payment handoff
```

Selection is application-level. The v1 policy chooses the lowest valid revealed
offer within the buyer's spending cap. Equal amounts are ordered by stable
resource ID and then the Sub Rosa bidder address. The policy is an isolated
interface and can be replaced without changing Core v2.

## Why ReceiptOnly

OpenX402 retains payment requirements, payment authorization, verification, and
settlement. Sub Rosa only needs to prove that provider offers were sealed before
the shared boundary and revealed through the normal lifecycle.

The pilot therefore uses the SDK's `createSealedProposalRound` and
`sealProposal` helpers. `ReceiptOnly` requires zero escrow, moves no payment
asset, completes during `clearV2`, and writes no economic winner. The selected
provider exists only in pilot application state and must not be confused with a
Sub Rosa protocol winner.

## Why Not Hide Bazaar Prices

Existing listed prices are public. Hiding a copy of an already-public fixed
price would add no useful privacy or competition.

The pilot instead models a separate competitive request: several discovered
resources can submit request-specific sealed offers. Public listing prices stay
visible as discovery metadata. Private competitive quote amounts and terms stay
sealed until reveal.

## Low Value vs High Value

The meeting hypothesis is:

- low-value requests may use Sub Rosa as a lightweight sealed competition layer;
- higher-value requests may justify full provider negotiation outside this pilot.

This is a design hypothesis being tested, not a claim that OpenX402 currently
implements either routing policy.

## Trust Boundaries

OpenX402 owns:

- service discovery and registered resource metadata;
- x402 payment requirements;
- buyer payment and allowance interfaces;
- payment verification and settlement;
- its existing marketplace architecture.

Sub Rosa owns:

- sealed provider offers;
- confidentiality before the Drand boundary;
- reveal and `ReceiptOnly` finalization;
- canonical Sub Rosa round evidence.

The pilot application owns:

- the buyer request and spending policy;
- normalization of discovery results;
- resource binding and revealed-offer validation;
- provider selection;
- the handoff between Sub Rosa evidence and OpenX402 payment.

The spending cap is not Sub Rosa escrow, OpenX402 payment authorization, or
proof that funds are available. Request-payload privacy is also outside v1;
Sub Rosa currently seals competitive provider offers, not private delivery of
the buyer's API request.

## Discovery Integration

The repository contains an isolated `OpenX402DiscoveryAdapter` interface. The
current implementation is `FixtureOpenX402DiscoveryAdapter` and is labeled
`DEMO DISCOVERY DATA` in every workspace view.

The sample providers are:

- Atlas Risk API;
- Orbit Analysis;
- StellarScope.

They are not represented as registered OpenX402 providers or real MCP results.
The adapter normalizes each fixture into a stable resource ID, resource
reference, provider name, public listed amount, network, asset, payee,
metadata digest, and canonical resource digest.

Every sealed offer binds that resource digest plus the request-specific quote,
response target, terms, and validity deadline. After reveal the application
rejects an offer if its discovered resource is missing or changed, or if its
network, asset, payee, amount, or freshness fails validation.

## Payment Integration

The repository contains an isolated `OpenX402PaymentAdapter` with conceptual
`preparePayment` and `executePayment` boundaries.

Current v1 behavior is intentionally limited:

- no real payment requirement is fabricated;
- no payment authorization is requested;
- no transaction is signed or submitted;
- no payment receipt or settlement hash is displayed;
- duplicate execution calls share one blocked application-level attempt.

Without an official mechanism that maps the selected competitive quote to the
actual x402 charge, preparation returns
`interface_confirmation_required`. If a fixed requirement differs from the
selected quote, it returns `dynamic_pricing_not_supported`. Requirement
identity, network, asset, payee, amount, and freshness must all pass before a
future execution adapter can proceed.

The UI reports:

```text
Payment handoff ready
OpenX402 pricing interface confirmation required
```

That state is the correct v1 terminal condition. It is not payment success.

## Evidence

The workspace keeps two sequential evidence records.

Sub Rosa evidence may include:

- Stellar network, contract, and numeric round ID;
- `ReceiptOnly` mode and deadline;
- committed and revealed offer counts;
- real Stellar transaction hashes returned by the SDK;
- canonical receipt export and offline verification.

OpenX402 evidence may include only real partner data:

- discovered resource identifier;
- actual payment requirement;
- selected-quote mapping;
- payment receipt or settlement reference.

The current discovery fixtures are visibly marked and the current payment
evidence remains unavailable. A Sub Rosa reveal receipt and an x402 settlement
receipt are linked application records; they are not atomic.

## Open Questions for OpenX402 Team

1. What exact MCP discovery interface should the pilot call?
2. What stable identifier should bind a Sub Rosa offer to an OpenX402 resource?
3. How should the selected competitive quote become the actual x402 payment amount?
4. Is there an official up-to allowance or dynamic payment-requirement interface for this flow?
5. How should an OpenX402 provider identity be bound to the Stellar wallet making the sealed offer?
6. Which payment network and asset should the first real pilot use?

## Future Production Integration

A confirmed integration can replace only the two pilot adapters:

```text
native OpenX402 discovery
  -> optional Sub Rosa sealed competition
  -> application selection
  -> native OpenX402 payment
```

The Sub Rosa contract, tlock format, keeper, and receipt verifier do not need a
partner-specific rewrite. A production integration should preserve explicit
buyer confirmation and native OpenX402 idempotency at the payment boundary.

## SCF Evidence View

The dedicated evidence view reports:

- partner workflow and `ReceiptOnly` mode;
- discovered provider count and fixture/real source;
- sealed and revealed offer counts;
- buyer spending cap;
- application-selected provider;
- payment handoff state;
- real Sub Rosa receipt and Stellar transactions when present;
- real OpenX402 evidence only when present.

Safe public wording is "OpenX402 × Sub Rosa pilot" or "sealed agent bidding
pilot." Do not describe this workspace as an official production integration.
