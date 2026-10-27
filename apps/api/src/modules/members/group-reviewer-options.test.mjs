import assert from "node:assert/strict";
import test from "node:test";
import { toGroupReviewerOptions } from "../../../dist/modules/members/group-reviewer-options.js";

test("group reviewer options include current members, submission totals, and stable name order", () => {
  assert.deepEqual(toGroupReviewerOptions(
    [
      { id: "reviewer-b", user: { displayName: "Bora" } },
      { id: "reviewer-a", user: { displayName: "Amina" } },
    ],
    [
      { reviewerId: "reviewer-b", _count: { _all: 2 } },
      { reviewerId: "reviewer-a", _count: { _all: 4 } },
      { reviewerId: "reviewer-old", _count: { _all: 3 } },
    ],
    [{ id: "reviewer-old", user: { displayName: "Adam" } }],
  ), [
    { reviewerId: "reviewer-old", reviewerName: "Adam", submissionCount: 3 },
    { reviewerId: "reviewer-a", reviewerName: "Amina", submissionCount: 4 },
    { reviewerId: "reviewer-b", reviewerName: "Bora", submissionCount: 2 },
  ]);
});

test("group reviewer options retain current members with zero submissions", () => {
  assert.deepEqual(toGroupReviewerOptions(
    [{ id: "reviewer-a", user: { displayName: "Amina" } }],
    [],
    [],
  ), [{ reviewerId: "reviewer-a", reviewerName: "Amina", submissionCount: 0 }]);
});
