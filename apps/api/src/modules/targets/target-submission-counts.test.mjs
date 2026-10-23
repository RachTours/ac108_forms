import assert from "node:assert/strict";
import test from "node:test";
import { targetSubmissionCountFilter } from "../../../dist/modules/targets/target-submission-counts.js";

test("target submission counts include only active submissions from the current organization", () => {
  assert.deepEqual(targetSubmissionCountFilter("org-a"), { organizationId: "org-a", archivedAt: null });
});
