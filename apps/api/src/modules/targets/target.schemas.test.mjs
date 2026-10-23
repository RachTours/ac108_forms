import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSchema, updateTargetSchema } from "../../../dist/modules/targets/target.schemas.js";

test("new review targets can be created without assignment data", () => {
  const reviewerId = "8bd11f59-87b2-4ac2-8450-adf0e5e8094d";
  assert.deepEqual(createTargetSchema.parse({ displayName: "Alex Morgan", email: "alex@example.com" }), { displayName: "Alex Morgan", email: "alex@example.com" });
  assert.deepEqual(createTargetSchema.parse({ displayName: "Alex Morgan", email: "" }), { displayName: "Alex Morgan", email: "" });
});

test("target input rejects malformed IDs and update requests cannot change assignment", () => {
  assert.throws(() => createTargetSchema.parse({ displayName: "Alex", reviewerId: "8bd11f59-87b2-4ac2-8450-adf0e5e8094d" }));
  assert.throws(() => updateTargetSchema.parse({ reviewerId: "8bd11f59-87b2-4ac2-8450-adf0e5e8094d" }));
  assert.throws(() => createTargetSchema.parse({ displayName: "Alex", unexpected: true }));
});
