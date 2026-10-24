import assert from "node:assert/strict";
import test from "node:test";
import { requestedReviewerScope } from "../../../dist/modules/submissions/submission-scope.js";

test("reviewer submission scope always stays on the authenticated membership", () => {
  assert.equal(requestedReviewerScope("REVIEWER", "own-membership", "other-reviewer"), "own-membership");
});

test("workspace admins can optionally filter submissions to a selected reviewer", () => {
  assert.equal(requestedReviewerScope("ADMIN", "admin-membership", "selected-reviewer"), "selected-reviewer");
  assert.equal(requestedReviewerScope("OWNER", "owner-membership"), undefined);
});
