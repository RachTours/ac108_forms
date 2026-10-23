import assert from "node:assert/strict";
import test from "node:test";

const memberCounts = await import("../../../dist/modules/members/member-counts.js");

test("member count queries group by reviewer under the organization and merge missing counts as zero", async () => {
  const calls = [];
  const reader = {
    assignment: { groupBy: async (query) => { calls.push(["assignment", query]); return [{ reviewerId: "reviewer-a", _count: { _all: 3 } }]; } },
    reviewLink: { groupBy: async (query) => { calls.push(["reviewLink", query]); return [{ reviewerId: "reviewer-b", _count: { _all: 2 } }]; } },
  };
  const result = await memberCounts.loadMemberCounts(reader, "org-a", ["reviewer-a", "reviewer-b"]);
  assert.deepEqual(result.get("reviewer-a"), { assignments: 3, reviewLinks: 0 });
  assert.deepEqual(result.get("reviewer-b"), { assignments: 0, reviewLinks: 2 });
  assert.deepEqual(calls.map(([table]) => table), ["assignment", "reviewLink"]);
  for (const [, query] of calls) {
    assert.deepEqual(query.by, ["reviewerId"]);
    assert.equal(query.where.organizationId, "org-a");
    assert.deepEqual(query.where.reviewerId.in, ["reviewer-a", "reviewer-b"]);
    assert.deepEqual(query._count, { _all: true });
  }
});

test("member count queries avoid database calls for an empty membership page", async () => {
  const reader = { assignment: { groupBy: async () => { throw new Error("unexpected assignment query"); } }, reviewLink: { groupBy: async () => { throw new Error("unexpected link query"); } } };
  assert.deepEqual(await memberCounts.loadMemberCounts(reader, "org-a", []), new Map());
});
