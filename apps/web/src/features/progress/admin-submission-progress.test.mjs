import assert from "node:assert/strict";
import test from "node:test";
import { getAdminSubmissionProgress } from "./admin-submission-progress.ts";

test("admin progress uses summed group goals even before group workflows are activated", () => {
  assert.deepEqual(getAdminSubmissionProgress({
    groupWorkflowsEnabled: false,
    groupGoalTotal: 150,
    groupSubmissionCount: 71,
    submissionGoal: 100,
    responseCount: 71,
    submissionCompletionPercent: 71,
  }), { goal: 150, submissions: 71, percent: 47.3, usesGroupGoals: true });
});

test("admin progress keeps the legacy workspace goal when no group goals exist", () => {
  assert.deepEqual(getAdminSubmissionProgress({
    groupWorkflowsEnabled: false,
    groupGoalTotal: 0,
    groupSubmissionCount: 0,
    submissionGoal: 50,
    responseCount: 14,
    submissionCompletionPercent: 28,
  }), { goal: 50, submissions: 14, percent: 28, usesGroupGoals: false });
});
