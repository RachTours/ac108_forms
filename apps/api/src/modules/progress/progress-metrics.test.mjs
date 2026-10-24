import test from "node:test";
import assert from "node:assert/strict";
import {
  getReviewerSubmissionMetrics,
  getReviewerSubmissionGoal,
  getSubmissionCompletionPercent,
  getWorkspaceSubmissionGoal,
} from "../../../dist/modules/progress/progress-metrics.js";

test("submission progress is measured against the workspace goal", () => {
  assert.equal(getSubmissionCompletionPercent(2, 50), 4);
  assert.equal(getSubmissionCompletionPercent(3, 50), 6);
});

test("submission progress keeps one decimal place when the percentage is fractional", () => {
  assert.equal(getSubmissionCompletionPercent(1, 40), 2.5);
  assert.equal(getSubmissionCompletionPercent(13, 500), 2.6);
});

test("progress is zero when the workspace goal is zero or invalid", () => {
  assert.equal(getSubmissionCompletionPercent(0, 0), 0);
  assert.equal(getSubmissionCompletionPercent(4, 0), 0);
  assert.equal(getSubmissionCompletionPercent(4, -1), 0);
  assert.equal(getSubmissionCompletionPercent(4, Number.NaN), 0);
});

test("progress is capped at the workspace goal", () => {
  assert.equal(getSubmissionCompletionPercent(60, 50), 100);
});

test("workspace submission goal falls back to the migration default for null or zero legacy values", () => {
  assert.equal(getWorkspaceSubmissionGoal(null), 50);
  assert.equal(getWorkspaceSubmissionGoal(0), 50);
  assert.equal(getWorkspaceSubmissionGoal(24), 24);
});

test("reviewer submission goal is the exact shared workspace goal fraction", () => {
  assert.equal(getReviewerSubmissionGoal(50, 5), 10);
  assert.equal(getReviewerSubmissionGoal(50, 6), 50 / 6);
  assert.equal(getReviewerSubmissionGoal(50, 0), null);
});

test("reviewer submission metrics round remaining submissions up without rounding the goal", () => {
  assert.deepEqual(getReviewerSubmissionMetrics(8, 50, 6), {
    reviewerSubmissionGoal: 50 / 6,
    submissionRatio: 0.96,
    submissionsRemaining: 1,
    submissionPercent: 96,
    submissionGoalMet: false,
  });
  assert.deepEqual(getReviewerSubmissionMetrics(9, 50, 6), {
    reviewerSubmissionGoal: 50 / 6,
    submissionRatio: 1,
    submissionsRemaining: 0,
    submissionPercent: 100,
    submissionGoalMet: true,
  });
});

test("reviewer submission metrics have no target and no percent with no active reviewers", () => {
  assert.deepEqual(getReviewerSubmissionMetrics(8, 50, 0), {
    reviewerSubmissionGoal: null,
    submissionRatio: null,
    submissionsRemaining: null,
    submissionPercent: 0,
    submissionGoalMet: false,
  });
});
