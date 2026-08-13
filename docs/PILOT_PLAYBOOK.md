# Partner Pilot Playbook

## Purpose

Pilots exist to test demand and integration quality, not to repeat an internal
demo. Every pilot must use external participants and end with a written partner
decision.

Sub Rosa supports two pilot tracks:

| Track | Template | Question |
| --- | --- | --- |
| Design-partner pilot | `ReceiptOnly` sealed proposal | Can another platform embed confidential submissions with little engineering work? |
| Economic pilot | `Auction` asset sale | Does sealed bidding plus atomic settlement create enough value to run repeated rounds? |

An interested team is not a completed pilot. Name a partner publicly only at
the commitment level they explicitly approved.

## Design-partner pilot

Use this track for a service marketplace or similar platform that wants private
price, timeline, and approach submissions without escrow in the first version.

Minimum flow:

1. Partner supplies one realistic request.
2. At least three external providers submit sealed proposals.
3. No proposal is readable before the configured Drand round.
4. Proposals reveal together and produce a canonical receipt.
5. Partner records integration effort, usability feedback, and next step.

This track validates the SDK, hosted flow, and proposal UX. It does not count as
economic settlement evidence.

The [Offer-Hub pilot workflow](./pilots/OFFER_HUB_PILOT.md) is the reference
standalone implementation for this track. It keeps marketplace selection and
payment outside Sub Rosa while exercising the real `ReceiptOnly` lifecycle.

The [OpenX402 pilot](./pilots/OPENX402_PILOT.md) applies the same boundary to
agent services: fixture-backed discovery, resource-bound sealed offers,
application selection, and a typed payment handoff that remains blocked until
OpenX402 confirms how a selected competitive quote becomes the actual charge.

## Economic auction pilot

Use this track for a marketplace, asset issuer, game, collectible, or other
Stellar application with a real auctionable lot.

Minimum flow:

1. Seller deposits one testnet lot into the round contract.
2. At least three external bidders submit sealed bids using the same
   contract-enforced fixed escrow.
3. Drand opens the reveal for all submissions.
4. The contract chooses the highest valid bid.
5. One settlement transfers winner payment to the seller and the lot to the
   winner.
6. Losing escrow is refunded and the final receipt is published.

The first pilot can use the capped Core v2 mainnet deployment after independent
contract review and explicit value caps.

## Evidence record

Capture the following for every round:

- partner and exact commitment level;
- contract ID, round ID, network, and Drand round;
- template and payload schema;
- number of external participants;
- total escrow, winning payment, lot amount, and refund status when applicable;
- keeper actions and final status;
- integration time and partner code changes;
- participant and organizer feedback;
- defects or confusing states;
- written go/no-go or next-step decision.

## Success criteria

| Question | Required evidence |
| --- | --- |
| Was early information leakage a real problem? | Partner describes the problem in its own workflow |
| Was integration lightweight? | Measured setup time and code changes |
| Did the protocol complete? | Public settled round and receipt |
| Were funds conserved? | Auction settlement and refunds match round state |
| Did users understand the flow? | External participant feedback |
| Is there repeat potential? | Another round, integration request, or explicit no-go with reasons |

## Outreach rule

Approach partners only after the public SDK installs from a clean project and
the hosted template is available. Offer the smallest pilot that fits their
capacity; do not ask them to rewrite their application or commit to mainnet.
