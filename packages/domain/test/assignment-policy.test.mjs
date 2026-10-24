import assert from "node:assert/strict";
import test from "node:test";
import { canAutoAssignTarget, canApplyAssignmentVersion, selectLeastLoadedReviewer } from "../dist/assignment-policy.js";

const candidates = [
  { id: "reviewer-b", organizationId: "org-a", role: "REVIEWER", status: "ACTIVE", userStatus: "ACTIVE", load: 1, stableOrder: "2026-01-01T00:00:00.000Z" },
  { id: "reviewer-a", organizationId: "org-a", role: "REVIEWER", status: "ACTIVE", userStatus: "ACTIVE", load: 1, stableOrder: "2026-01-01T00:00:00.000Z" },
];

test("least-loaded policy resolves ties by stable creation order then membership ID", () => {
  assert.equal(selectLeastLoadedReviewer("org-a", candidates)?.id, "reviewer-a");
  assert.equal(selectLeastLoadedReviewer("org-a", [candidates[0], { ...candidates[1], stableOrder: "2025-01-01T00:00:00.000Z" }])?.id, "reviewer-a");
});

test("policy excludes inactive, non-reviewer, and cross-organization memberships", () => {
  const ineligible = [
    { ...candidates[0], status: "ARCHIVED", load: 0 },
    { ...candidates[0], id: "admin", role: "ADMIN", load: 0 },
    { ...candidates[0], id: "other-org", organizationId: "org-b", load: 0 },
    { ...candidates[0], id: "inactive-user", userStatus: "ARCHIVED", load: 0 },
  ];
  assert.equal(selectLeastLoadedReviewer("org-a", [...ineligible, ...candidates])?.id, "reviewer-a");
  assert.equal(selectLeastLoadedReviewer("org-b", candidates), null);
  assert.equal(selectLeastLoadedReviewer("org-a", []), null);
});

test("policy rejects invalid loads and never changes workload input", () => {
  const before = structuredClone(candidates);
  assert.equal(selectLeastLoadedReviewer("org-a", [{ ...candidates[0], load: -1 }, candidates[1]])?.id, "reviewer-a");
  assert.deepEqual(candidates, before);
});

test("auto-assignment is limited to active targets in the workspace without an eligible current assignment", () => {
  const active = { organizationId: "org-a", status: "ACTIVE", archivedAt: null };
  assert.equal(canAutoAssignTarget("org-a", active, null), true);
  assert.equal(canAutoAssignTarget("org-a", { ...active, status: "ARCHIVED" }, null), false);
  assert.equal(canAutoAssignTarget("org-a", { ...active, archivedAt: new Date() }, null), false);
  assert.equal(canAutoAssignTarget("org-a", { ...active, organizationId: "org-b" }, null), false);
  assert.equal(canAutoAssignTarget("org-a", active, { organizationId: "org-a", reviewerEligible: true }), false);
  assert.equal(canAutoAssignTarget("org-a", active, { organizationId: "org-a", reviewerEligible: false }), true);
  assert.equal(canAutoAssignTarget("org-a", active, { organizationId: "org-b", reviewerEligible: true }), false);
});

test("assignment writes honor optimistic versions and only allow implicit replacement of inactive reviewers", () => {
  assert.equal(canApplyAssignmentVersion(null, null, false), true);
  assert.equal(canApplyAssignmentVersion(100, 100, true), true);
  assert.equal(canApplyAssignmentVersion(100, 99, true), false);
  assert.equal(canApplyAssignmentVersion(100, null, true), false);
  assert.equal(canApplyAssignmentVersion(100, null, false), true);
});
