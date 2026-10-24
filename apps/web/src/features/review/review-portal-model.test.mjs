import assert from "node:assert/strict";
import test from "node:test";
import { buildInitialAnswers, shouldShowReviewTargetSelector } from "./review-portal-model.ts";

test("required ranking fields start with every option in the displayed order", () => {
  const fields = [
    { id: "rank-1", type: "ranking", required: true, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
    { id: "text-1", type: "shortText", required: true },
  ];
  assert.deepEqual(buildInitialAnswers(fields), { "rank-1": ["a", "b"] });
});

test("changing forms can seed the selected ranking without retaining old answers", () => {
  const fields = [{ id: "rank-2", type: "ranking", required: false, options: [{ id: "c", label: "C" }, { id: "d", label: "D" }] }];
  assert.deepEqual(buildInitialAnswers(fields), { "rank-2": ["c", "d"] });
});

test("target selector is omitted for private links with zero or one assigned person", () => {
  assert.equal(shouldShowReviewTargetSelector(0), false);
  assert.equal(shouldShowReviewTargetSelector(1), false);
});

test("target selector stays available when a reviewer has multiple assigned people", () => {
  assert.equal(shouldShowReviewTargetSelector(2), true);
});
