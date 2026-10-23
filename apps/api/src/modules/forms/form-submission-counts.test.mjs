import test from "node:test";
import assert from "node:assert/strict";
import { formSubmissionCountFilter } from "../../../dist/modules/forms/form-submission-counts.js";

test("form submission counts stay scoped to the organization", () => {
  assert.deepEqual(formSubmissionCountFilter("org-1"), { organizationId: "org-1" });
});
