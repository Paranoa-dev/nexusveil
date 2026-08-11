import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hashFor,
  offerHubPilotRoundIdFromHash,
  pilotRoundIdFromHash,
  routeFromHash,
  trustlessWorkPilotRoundIdFromHash,
} from "./routing";

test("pilot routes open the partner workspace", () => {
  assert.deepEqual(routeFromHash("#/pilot"), {
    page: "pilotCatalog",
    useCase: "auction",
  });
  assert.deepEqual(routeFromHash("#/pilot/42"), {
    page: "basicPilot",
    useCase: "auction",
  });
  assert.deepEqual(routeFromHash("#/pilot/basic"), {
    page: "basicPilot",
    useCase: "auction",
  });
  assert.deepEqual(routeFromHash("#/pilot/the-signal"), {
    page: "signalPilot",
    useCase: "auction",
  });
  assert.deepEqual(routeFromHash("#/pilot/trustless-work"), {
    page: "trustlessWorkPilot",
    useCase: "auction",
  });
  assert.deepEqual(routeFromHash("#/pilot/offer-hub"), {
    page: "offerHubPilot",
    useCase: "auction",
  });
});

test("pilot round links accept only numeric round ids", () => {
  assert.equal(pilotRoundIdFromHash("#/pilot/42"), "42");
  assert.equal(pilotRoundIdFromHash("#pilot/0007"), "0007");
  assert.equal(pilotRoundIdFromHash("#/pilot/not-a-round"), "");
  assert.equal(pilotRoundIdFromHash("#/demo/42"), "");
});

test("pilot navigation emits the canonical workspace hash", () => {
  assert.equal(hashFor("pilotCatalog"), "#/pilot");
  assert.equal(hashFor("basicPilot"), "#/pilot/basic");
  assert.equal(hashFor("signalPilot"), "#/pilot/the-signal");
  assert.equal(hashFor("trustlessWorkPilot"), "#/pilot/trustless-work");
  assert.equal(hashFor("offerHubPilot"), "#/pilot/offer-hub");
});

test("offer-hub pilot round links accept only numeric round ids", () => {
  assert.equal(offerHubPilotRoundIdFromHash("#/pilot/offer-hub/42"), "42");
  assert.equal(offerHubPilotRoundIdFromHash("#pilot/offer-hub/0007"), "0007");
  assert.equal(offerHubPilotRoundIdFromHash("#/pilot/offer-hub/not-a-round"), "");
});

test("trustless work pilot round links accept only numeric round ids", () => {
  assert.equal(trustlessWorkPilotRoundIdFromHash("#/pilot/trustless-work/42"), "42");
  assert.equal(trustlessWorkPilotRoundIdFromHash("#pilot/trustless-work/0007"), "0007");
  assert.equal(trustlessWorkPilotRoundIdFromHash("#/pilot/trustless-work/not-a-round"), "");
});

test("docs route and navigation use the canonical hash", () => {
  assert.deepEqual(routeFromHash("#/docs"), {
    page: "docs",
    useCase: "auction",
  });
  assert.equal(hashFor("docs"), "#/docs");
});
