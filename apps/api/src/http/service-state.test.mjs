import assert from "node:assert/strict";
import test from "node:test";
import { isDraining, markDraining } from "../../dist/http/service-state.js";

test("service becomes draining once shutdown starts and remains draining", () => {
  assert.equal(isDraining(), false);
  markDraining();
  assert.equal(isDraining(), true);
  markDraining();
  assert.equal(isDraining(), true);
});
