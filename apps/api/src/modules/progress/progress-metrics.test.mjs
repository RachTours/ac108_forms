import test from "node:test";
import assert from "node:assert/strict";
import { getCompletionPercent } from "../../../dist/modules/progress/progress-metrics.js";

test("reviewer completion uses the workspace goal instead of assigned targets", () => {
  assert.equal(getCompletionPercent(1, 50), 2);
});

test("progress is zero when the workspace goal is zero", () => {
  assert.equal(getCompletionPercent(0, 0), 0);
});

test("progress is capped at the workspace goal", () => {
  assert.equal(getCompletionPercent(60, 50), 100);
});
