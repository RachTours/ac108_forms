import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProgressConfigUpdate,
  progressConfigPatchSchema,
  toProgressSummaryResponse,
  toReviewerBoardRow,
} from "../../../dist/modules/progress/progress.routes.js";

test("progress config PATCH can change the people goal without replacing the submission goal", () => {
  const input = progressConfigPatchSchema.parse({ targetCount: 75, completionRule: "ONE_RESPONSE" });
  assert.deepEqual(buildProgressConfigUpdate({ targetCount: 50, submissionGoal: 40 }, input), {
    targetCount: 75,
    submissionGoal: 40,
    completionRule: "ONE_RESPONSE",
  });
});

test("progress config PATCH can change the submission goal without replacing the people goal", () => {
  const input = progressConfigPatchSchema.parse({ submissionGoal: 80, completionRule: "ONE_RESPONSE" });
  assert.deepEqual(buildProgressConfigUpdate({ targetCount: 50, submissionGoal: 40 }, input), {
    targetCount: 50,
    submissionGoal: 80,
    completionRule: "ONE_RESPONSE",
  });
});

test("progress config PATCH rejects invalid submission goals", () => {
  for (const submissionGoal of [0, -1, 100_001, 1.5]) {
    assert.throws(() => progressConfigPatchSchema.parse({ submissionGoal, completionRule: "ONE_RESPONSE" }));
  }
  assert.throws(() => progressConfigPatchSchema.parse({ completionRule: "ONE_RESPONSE" }), "a PATCH needs a goal field");
});

test("summary keeps people completion separate from workspace submission progress", () => {
  const summary = toProgressSummaryResponse({
    activeTargets: 30,
    assignedTargets: 24,
    completedTargets: 12,
    responseCount: 20,
    unassignedTargets: 6,
    targetCount: 40,
    completionRule: "ONE_RESPONSE",
    submissionGoal: 50,
    activeReviewerCount: 5,
    reviewerAudience: false,
  });
  assert.equal(summary.targetCount, 40);
  assert.equal(summary.completedTargets, 12);
  assert.equal(summary.submissionGoal, 50);
  assert.equal(summary.submissionCompletionPercent, 40);
  assert.equal(summary.reviewerSubmissionGoal, null);
});

test("reviewer board retains author submission credit after the current assignment is gone", () => {
  const row = toReviewerBoardRow({ reviewerId: "reviewer-a", displayName: "Amina", assigned: 0n, completed: 0n, submissionCount: 9n }, 50, 6);
  assert.deepEqual(row, {
    reviewerId: "reviewer-a",
    displayName: "Amina",
    groupId: null,
    assigned: 0,
    completed: 0,
    submissionCount: 9,
    reviewerSubmissionGoal: 50 / 6,
    submissionRatio: 1,
    submissionsRemaining: 0,
    submissionPercent: 100,
    submissionGoalMet: true,
  });
});
