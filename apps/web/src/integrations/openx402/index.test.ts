import assert from "node:assert/strict";
import { test } from "node:test";

import { decodePayloadEnvelope, encodePayloadEnvelope } from "@sub-rosa/tlock";
import { encodeSealedProposal } from "@sub-rosa/sdk";

import {
  DEFAULT_OPENX402_REQUEST,
  FixtureOpenX402DiscoveryAdapter,
  TypedOpenX402PaymentAdapter,
  buildOpenX402RoundParams,
  decodeOpenX402OfferEnvelope,
  defaultOpenX402OfferDraft,
  defaultOpenX402Workspace,
  evaluateAndSelectOpenX402Offer,
  mapOpenX402Offer,
  openX402OfferToProposal,
  openX402ResourceDigest,
  parseOpenX402Workspace,
  serializeOpenX402Workspace,
  validateOpenX402Offer,
  type OpenX402Offer,
  type OpenX402PaymentRequirement,
} from "./index";

const NOW = 1_800_000_000;

async function setup() {
  const discovery = await new FixtureOpenX402DiscoveryAdapter().discoverResources(DEFAULT_OPENX402_REQUEST);
  const resource = discovery.resources[0]!;
  const offer = mapOpenX402Offer({
    draft: defaultOpenX402OfferDraft(resource.id),
    resource,
    bidder: "GBIDDER",
    decimals: DEFAULT_OPENX402_REQUEST.decimals,
    now: NOW,
  });
  return { discovery, resource, offer };
}

test("fixture discovery is visibly labeled and normalized", async () => {
  const { discovery } = await setup();
  assert.equal(discovery.mode, "fixture");
  assert.equal(discovery.label, "DEMO DISCOVERY DATA");
  assert.equal(discovery.resources.length, 3);
  for (const resource of discovery.resources) {
    assert.equal(resource.source, "fixture");
    assert.equal(resource.resourceDigest.length, 64);
    assert.ok(resource.network);
    assert.ok(resource.asset);
    assert.ok(resource.payTo);
  }
});

test("resource digest binds normalized discovery identity", async () => {
  const { resource } = await setup();
  const { resourceDigest: _digest, ...identity } = resource;
  assert.equal(await openX402ResourceDigest(identity), resource.resourceDigest);
  assert.notEqual(
    await openX402ResourceDigest({ ...identity, payTo: "changed-payee" }),
    resource.resourceDigest,
  );
});

test("OpenX402 round params use ReceiptOnly with no economic settlement", async () => {
  const round = buildOpenX402RoundParams({
    itemRef: new Uint8Array(32),
    revealRound: 42,
    commitDeadline: 100,
    revealDeadline: 200,
    auditorPubkey: new Uint8Array(32),
  });
  assert.equal(round.mode, "ReceiptOnly");
  assert.equal(round.fixedEscrow, 0n);
  assert.equal(round.paymentAsset, undefined);
  assert.equal(round.lotAsset, undefined);
});

test("offer schema round-trips through the canonical ReceiptOnly envelope", async () => {
  const { offer } = await setup();
  const proposal = openX402OfferToProposal(offer);
  const payload = encodeSealedProposal(proposal);
  const envelope = encodePayloadEnvelope({
    amount: BigInt(offer.quotedAmountBaseUnits),
    nonce: new Uint8Array(32).fill(7),
    payload,
  });
  assert.equal(decodePayloadEnvelope(envelope).amount, BigInt(offer.quotedAmountBaseUnits));
  assert.deepEqual(decodeOpenX402OfferEnvelope(envelope, offer.bidder), offer);
});

test("sealed offer presentation can hide private fields before reveal", async () => {
  const { offer } = await setup();
  const sealedView = { bidder: offer.bidder, revealed: false, amount: null, terms: null };
  assert.equal(sealedView.amount, null);
  assert.equal(sealedView.terms, null);
  assert.ok(!JSON.stringify(sealedView).includes(offer.quotedAmountBaseUnits));
});

test("offer validation rejects changed resources and incompatible payment fields", async () => {
  const { discovery, offer } = await setup();
  const validate = (candidate: OpenX402Offer) => validateOpenX402Offer({
    offer: candidate,
    resources: discovery.resources,
    maximumPaymentBaseUnits: DEFAULT_OPENX402_REQUEST.maximumPaymentBaseUnits,
    now: NOW,
  });
  assert.equal(validate(offer).code, "valid");
  assert.equal(validate({ ...offer, resourceDigest: "0".repeat(64) }).code, "resource_changed");
  assert.equal(validate({ ...offer, network: "eip155:1" }).code, "network_mismatch");
  assert.equal(validate({ ...offer, asset: "changed" }).code, "asset_mismatch");
  assert.equal(validate({ ...offer, payTo: "changed" }).code, "payee_mismatch");
  assert.equal(validate({ ...offer, validUntil: NOW }).code, "expired_offer");
  assert.equal(validate({ ...offer, quotedAmountBaseUnits: "5000001" }).code, "above_allowance");
});

test("lowest valid selection is application-level with deterministic ties", async () => {
  const { discovery, offer } = await setup();
  const second = {
    ...offer,
    bidder: "A-TIE-BIDDER",
    resourceId: discovery.resources[1]!.id,
    resourceDigest: discovery.resources[1]!.resourceDigest,
    provider: discovery.resources[1]!.provider,
    payTo: discovery.resources[1]!.payTo,
    metadataDigest: discovery.resources[1]!.metadataDigest,
  };
  const higher = { ...offer, bidder: "HIGH", quotedAmountBaseUnits: "4000000" };
  const selected = evaluateAndSelectOpenX402Offer({
    offers: [higher, second, offer],
    resources: discovery.resources,
    maximumPaymentBaseUnits: "5000000",
    now: NOW,
  });
  assert.equal(selected.policyId, "lowest-valid-offer-v1");
  assert.equal(selected.selected?.resourceId, "demo:atlas-risk-api");
  assert.equal(selected.selected?.validation.valid, true);
  assert.equal(buildOpenX402RoundParams({
    itemRef: new Uint8Array(32), revealRound: 2, commitDeadline: 1, revealDeadline: 3, auditorPubkey: new Uint8Array(),
  }).mode, "ReceiptOnly");
});

test("payment handoff blocks missing and incompatible dynamic pricing interfaces", async () => {
  const { resource, offer } = await setup();
  const adapter = new TypedOpenX402PaymentAdapter();
  const pending = adapter.preparePayment({
    resource,
    selectedOffer: offer,
    maximumPaymentBaseUnits: "5000000",
    now: NOW,
  });
  assert.equal(pending.status, "interface_confirmation_required");

  const requirement: OpenX402PaymentRequirement = {
    resourceId: resource.id,
    resource: resource.resource,
    network: resource.network,
    asset: resource.asset,
    payTo: resource.payTo,
    amountBaseUnits: resource.publicListedAmountBaseUnits!,
    validUntil: NOW + 300,
    source: "real",
  };
  const blocked = adapter.preparePayment({
    resource,
    selectedOffer: offer,
    maximumPaymentBaseUnits: "5000000",
    paymentRequirement: requirement,
    now: NOW,
  });
  assert.equal(blocked.status, "dynamic_pricing_not_supported");
});

test("payment execution is unavailable and duplicate calls share one attempt", async () => {
  const { resource, offer } = await setup();
  const adapter = new TypedOpenX402PaymentAdapter();
  const handoff = adapter.preparePayment({
    resource,
    selectedOffer: offer,
    maximumPaymentBaseUnits: "5000000",
    now: NOW,
  });
  const first = adapter.executePayment(handoff);
  const second = adapter.executePayment(handoff);
  assert.equal(first, second);
  await assert.rejects(first, /unavailable/);
});

test("workspace persistence keeps revealed evidence but excludes pre-reveal offer contents", async () => {
  const { discovery, offer } = await setup();
  const workspace = {
    ...defaultOpenX402Workspace(),
    discoveryComplete: true,
    resources: discovery.resources,
    roundId: "42",
    sealedOfferCount: 3,
    selectedResourceId: discovery.resources[0]!.id,
    revealedOffers: [offer],
  };
  const sealed = serializeOpenX402Workspace(workspace);
  assert.deepEqual(parseOpenX402Workspace(sealed).revealedOffers, []);
  assert.ok(!sealed.includes(offer.terms));

  const revealed = { ...workspace, revealComplete: true };
  assert.deepEqual(parseOpenX402Workspace(serializeOpenX402Workspace(revealed)), revealed);
  assert.deepEqual(parseOpenX402Workspace("not-json"), defaultOpenX402Workspace());
});

test("workspace persistence validates the selectable commit duration", () => {
  const workspace = { ...defaultOpenX402Workspace(), commitDurationSeconds: 300 as const };
  assert.equal(parseOpenX402Workspace(serializeOpenX402Workspace(workspace)).commitDurationSeconds, 300);
  assert.equal(parseOpenX402Workspace(JSON.stringify({
    ...workspace,
    commitDurationSeconds: 999,
  })).commitDurationSeconds, 60);
});
