import assert from "node:assert/strict";
import { test } from "node:test";

import { hashFor, pilotRoundIdFromHash, routeFromHash } from "./routing";

test("pilot routes open the partner workspace", () => {
  assert.deepEqual(routeFromHash("#/pilot"), {
    page: "pilot",
    useCase: "auction",
  });
  assert.deepEqual(routeFromHash("#/pilot/42"), {
    page: "pilot",
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
  assert.equal(hashFor("pilot"), "#/pilot");
});
