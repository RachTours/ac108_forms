import assert from "node:assert/strict";
import test from "node:test";
import { formatReviewerSubmissionGoal } from "./reviewer-submission-goal.ts";

test("reviewer submission goal explains the shared fractional division", () => {
  assert.equal(formatReviewerSubmissionGoal(50, 5), "50 submissions ÷ 5 active reviewers = 10 submissions per reviewer.");
  assert.equal(formatReviewerSubmissionGoal(50, 6), "50 submissions ÷ 6 active reviewers = 8.33 submissions per reviewer.");
});

test("reviewer submission goal explains when there are no active reviewers", () => {
  assert.equal(formatReviewerSubmissionGoal(50, 0), "Add an active reviewer to calculate the shared submission goal.");
});
