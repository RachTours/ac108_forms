import assert from "node:assert/strict";
import test from "node:test";
import { assignmentListSchema, removeAssignmentSchema, setAssignmentSchema } from "../../../dist/modules/assignments/assignment.schemas.js";

test("assignment listing validates bounded server-side filters and pagination", () => {
  assert.deepEqual(assignmentListSchema.parse({ state: "unassigned", search: "  amina ", limit: "50" }), { state: "unassigned", search: "amina", limit: 50 });
  assert.throws(() => assignmentListSchema.parse({ limit: "101" }));
  assert.throws(() => assignmentListSchema.parse({ state: "completed" }));
});

test("assignment mutations require a reviewer and an explicit concurrency version", () => {
  const reviewerId = "8bd11f59-87b2-4ac2-8450-adf0e5e8094d";
  assert.equal(setAssignmentSchema.parse({ reviewerId, expectedUpdatedAt: null }).reviewerId, reviewerId);
  assert.equal(setAssignmentSchema.parse({ reviewerId, expectedUpdatedAt: "2026-10-23T10:00:00.000Z" }).expectedUpdatedAt.toISOString(), "2026-10-23T10:00:00.000Z");
  assert.throws(() => setAssignmentSchema.parse({ reviewerId }));
  assert.throws(() => removeAssignmentSchema.parse({ expectedUpdatedAt: "not-a-date" }));
});
