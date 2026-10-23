import test from "node:test";
import assert from "node:assert/strict";

const formCounts = await import("../../../dist/modules/forms/form-submission-counts.js");

test("form submission counts are grouped by bounded form IDs and scoped to the organization", async () => {
  const calls = [];
  const reader = { submission: { groupBy: async (query) => { calls.push(query); return [{ formId: "form-1", _count: { _all: 4 } }]; } } };
  const counts = await formCounts.loadFormSubmissionCounts(reader, "org-1", ["form-1", "form-2"]);
  assert.equal(counts.get("form-1"), 4);
  assert.equal(counts.get("form-2"), 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].by, ["formId"]);
  assert.equal(calls[0].where.organizationId, "org-1");
  assert.deepEqual(calls[0].where.formId.in, ["form-1", "form-2"]);
  assert.deepEqual(calls[0]._count, { _all: true });
});

test("form submission counts do not query when the form page is empty", async () => {
  const reader = { submission: { groupBy: async () => { throw new Error("unexpected database query"); } } };
  assert.deepEqual(await formCounts.loadFormSubmissionCounts(reader, "org-1", []), new Map());
});
