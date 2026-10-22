import assert from "node:assert/strict";
import test from "node:test";
import { assignmentCounts, filterAssignmentTargets } from "./assignment-view.ts";

const rows = [
  { id: "1", displayName: "Amina", email: "amina@example.test", assignedReviewer: null, submissionCount: 0 },
  { id: "2", displayName: "Bilal", email: null, assignedReviewer: { membershipId: "r1", displayName: "Reviewer One", email: "r1@example.test" }, submissionCount: 0 },
  { id: "3", displayName: "Chloe", email: null, assignedReviewer: { membershipId: "r2", displayName: "Reviewer Two", email: "r2@example.test" }, submissionCount: 1 },
];

test("assignment filters distinguish unassigned, in-progress and completed targets", () => {
  assert.deepEqual(filterAssignmentTargets(rows, "", "unassigned").map((row) => row.id), ["1"]);
  assert.deepEqual(filterAssignmentTargets(rows, "", "in-progress").map((row) => row.id), ["2"]);
  assert.deepEqual(filterAssignmentTargets(rows, "", "completed").map((row) => row.id), ["3"]);
});

test("reviewer filters and search include assigned reviewer names", () => {
  assert.deepEqual(filterAssignmentTargets(rows, "", "reviewer:r1").map((row) => row.id), ["2"]);
  assert.deepEqual(filterAssignmentTargets(rows, "reviewer two", "all").map((row) => row.id), ["3"]);
});

test("assignment counts reconcile across mutually exclusive work states", () => {
  assert.deepEqual(assignmentCounts(rows), { all: 3, unassigned: 1, inProgress: 1, completed: 1 });
});
