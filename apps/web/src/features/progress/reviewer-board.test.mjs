import assert from "node:assert/strict";
import test from "node:test";
import { getPeopleRemainingForGoal, getReviewerSortHint, sortReviewerProgress, toReviewerProgress } from "./reviewer-board.ts";

test("reviewer sorting explains when there are too few reviewers to change the visible order", () => {
  assert.equal(getReviewerSortHint(1), "Add another active reviewer to compare sort orders.");
  assert.equal(getReviewerSortHint(2), null);
});

test("people still to add counts the difference between the goal and active targets", () => {
  assert.equal(getPeopleRemainingForGoal(50, 2), 48);
});

test("people still to add never becomes negative after the goal is reached", () => {
  assert.equal(getPeopleRemainingForGoal(50, 52), 0);
});

const source = [
  { reviewerId: "a", displayName: "Ada", assigned: 0, completed: 0 },
  { reviewerId: "b", displayName: "Ben", assigned: 4, completed: 4 },
  { reviewerId: "c", displayName: "Cy", assigned: 4, completed: 2 },
];

test("review progress keeps zero assignments at zero and computes remaining work", () => {
  assert.deepEqual(toReviewerProgress(source), [
    { ...source[0], assignmentRemaining: 0, remaining: 0, percent: 0, assignmentStatus: "No assignments" },
    { ...source[1], assignmentRemaining: 0, remaining: 0, percent: 100, assignmentStatus: "Assigned work done" },
    { ...source[2], assignmentRemaining: 2, remaining: 2, percent: 50, assignmentStatus: "2 assigned remaining" },
  ]);
});

test("review board has deterministic default and user-selected sorts without ordinal rank", () => {
  const rows = toReviewerProgress(source);
  assert.deepEqual(sortReviewerProgress(rows, "completion").map((row) => row.reviewerId), ["b", "c", "a"]);
  assert.deepEqual(sortReviewerProgress(rows, "name").map((row) => row.reviewerId), ["a", "b", "c"]);
  assert.deepEqual(sortReviewerProgress(rows, "completed").map((row) => row.reviewerId), ["b", "c", "a"]);
  assert.deepEqual(sortReviewerProgress(rows, "fewest").map((row) => row.reviewerId), ["a", "b", "c"]);
});

test("reviewer board percentages use the shared target goal when it is provided", () => {
  const rows = toReviewerProgress([{ reviewerId: "r1", displayName: "Reviewer", assigned: 1, completed: 1 }], 50);
  assert.equal(rows[0].percent, 2);
  assert.equal(rows[0].remaining, 0);
  assert.equal(toReviewerProgress([{ reviewerId: "r1", displayName: "Reviewer", assigned: 1, completed: 1 }], 0)[0].percent, 0);
});

test("team progress excludes reviewers without assigned work from completion denominator", async () => {
  const { getTeamReviewerProgress } = await import("./reviewer-board.ts");
  assert.deepEqual(getTeamReviewerProgress([
    { reviewerId: "a", displayName: "A", assigned: 1, completed: 1 },
    { reviewerId: "b", displayName: "B", assigned: 1, completed: 0 },
    { reviewerId: "c", displayName: "C", assigned: 0, completed: 0 },
  ]), { totalReviewers: 2, completedReviewers: 1, percent: 50 });
});

test("team progress is zero when no active reviewer has assignments", async () => {
  const { getTeamReviewerProgress } = await import("./reviewer-board.ts");
  assert.deepEqual(getTeamReviewerProgress([{ reviewerId: "a", displayName: "A", assigned: 0, completed: 0 }]), { totalReviewers: 0, completedReviewers: 0, percent: 0 });
});

test("reviewer progress uses submission goals while keeping assignment completion separate", () => {
  const rows = toReviewerProgress([
    { reviewerId: "z", displayName: "Zed", assigned: 2, completed: 2, submissionCount: 8, reviewerSubmissionGoal: 50 / 6, submissionRatio: 0.96, submissionsRemaining: 1, submissionPercent: 96, submissionGoalMet: false },
    { reviewerId: "b", displayName: "Ben", assigned: 2, completed: 1, submissionCount: 9, reviewerSubmissionGoal: 50 / 6, submissionRatio: 1, submissionsRemaining: 0, submissionPercent: 100, submissionGoalMet: true },
    { reviewerId: "a", displayName: "Ada", assigned: 0, completed: 0, submissionCount: 12, reviewerSubmissionGoal: 50 / 6, submissionRatio: 1, submissionsRemaining: 0, submissionPercent: 100, submissionGoalMet: true },
  ]);

  assert.equal(rows.find((row) => row.reviewerId === "z").submissionStatus, "1 submission left");
  assert.equal(rows.find((row) => row.reviewerId === "z").assignmentStatus, "Assigned work done");
  assert.equal(rows.find((row) => row.reviewerId === "b").submissionStatus, "Goal met");
  assert.equal(rows.find((row) => row.reviewerId === "b").assignmentStatus, "1 assigned remaining");
  assert.equal(rows.find((row) => row.reviewerId === "a").assignmentStatus, "No assignments");
  assert.equal(rows.find((row) => row.reviewerId === "a").percent, 100);
});

test("reviewer sorting orders fewest submissions left first with stable ties", () => {
  const rows = toReviewerProgress([
    { reviewerId: "z", displayName: "Alex", assigned: 0, completed: 0, submissionCount: 4, reviewerSubmissionGoal: 10, submissionRatio: 0.4, submissionsRemaining: 6, submissionPercent: 40, submissionGoalMet: false },
    { reviewerId: "a", displayName: "Alex", assigned: 0, completed: 0, submissionCount: 9, reviewerSubmissionGoal: 10, submissionRatio: 0.9, submissionsRemaining: 1, submissionPercent: 90, submissionGoalMet: false },
    { reviewerId: "b", displayName: "Bea", assigned: 4, completed: 3, submissionCount: 8, reviewerSubmissionGoal: 10, submissionRatio: 0.8, submissionsRemaining: 2, submissionPercent: 80, submissionGoalMet: false },
  ]);

  assert.deepEqual(sortReviewerProgress(rows, "completion").map((row) => row.reviewerId), ["a", "b", "z"]);
  assert.deepEqual(sortReviewerProgress(rows, "name").map((row) => row.reviewerId), ["a", "z", "b"]);
  assert.deepEqual(sortReviewerProgress(rows, "completed").map((row) => row.reviewerId), ["a", "b", "z"]);
  assert.deepEqual(sortReviewerProgress(rows, "fewest").map((row) => row.reviewerId), ["a", "b", "z"]);
});

test("fewest left compares different personal goals and puts unconfigured goals last", () => {
  const rows = toReviewerProgress([
    { reviewerId: "far", displayName: "Far", assigned: 0, completed: 0, submissionCount: 1, reviewerSubmissionGoal: 100, submissionsRemaining: 99 },
    { reviewerId: "near", displayName: "Near", assigned: 0, completed: 0, submissionCount: 9, reviewerSubmissionGoal: 10, submissionsRemaining: 1 },
    { reviewerId: "none", displayName: "Ada", assigned: 0, completed: 0, submissionCount: 0, reviewerSubmissionGoal: null, submissionsRemaining: null },
    { reviewerId: "met", displayName: "Met", assigned: 0, completed: 0, submissionCount: 25, reviewerSubmissionGoal: 20, submissionsRemaining: 0 },
  ]);
  assert.deepEqual(sortReviewerProgress(rows, "fewest").map((row) => row.reviewerId), ["met", "near", "far", "none"]);
});

test("completion sort compares unrounded ratios and resolves exact ties by name then ID", () => {
  const rows = toReviewerProgress([
    { reviewerId: "2", displayName: "Zed", assigned: 0, completed: 0, submissionCount: 2, reviewerSubmissionGoal: 4, submissionRatio: 0.5014, submissionsRemaining: 2, submissionPercent: 50.1, submissionGoalMet: false },
    { reviewerId: "1", displayName: "Ada", assigned: 0, completed: 0, submissionCount: 2, reviewerSubmissionGoal: 4, submissionRatio: 0.5014, submissionsRemaining: 2, submissionPercent: 50.1, submissionGoalMet: false },
    { reviewerId: "3", displayName: "Bea", assigned: 0, completed: 0, submissionCount: 2, reviewerSubmissionGoal: 4, submissionRatio: 0.5011, submissionsRemaining: 2, submissionPercent: 50.1, submissionGoalMet: false },
  ]);

  assert.deepEqual(sortReviewerProgress(rows, "completion").map((row) => row.reviewerId), ["1", "2", "3"]);
  assert.deepEqual(sortReviewerProgress(rows, "completed").map((row) => row.reviewerId), ["1", "3", "2"]);
  assert.deepEqual(sortReviewerProgress(rows, "fewest").map((row) => row.reviewerId), ["1", "3", "2"]);
});
