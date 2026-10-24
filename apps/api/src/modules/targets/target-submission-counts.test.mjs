import assert from "node:assert/strict";
import test from "node:test";
import { loadTargetAssignments, loadTargetSubmissionCounts } from "../../../dist/modules/targets/target-submission-counts.js";

test("loads bounded active submission counts with an explicit workspace filter", async () => {
  let query;
  const transaction = {
    submission: {
      groupBy: async (input) => {
        query = input;
        return [
          { targetId: "target-1", _count: { _all: 2 } },
          { targetId: "target-2", _count: { _all: 1 } },
        ];
      },
    },
  };
  const counts = await loadTargetSubmissionCounts(transaction, "workspace-1", ["target-1", "target-2"]);
  assert.deepEqual([...counts], [["target-1", 2], ["target-2", 1]]);
  assert.deepEqual(query, {
    by: ["targetId"],
    where: { organizationId: "workspace-1", archivedAt: null, targetId: { in: ["target-1", "target-2"] } },
    _count: { _all: true },
  });
});

test("does not query counts for an empty target page", async () => {
  let called = false;
  const transaction = { submission: { groupBy: async () => { called = true; return []; } } };
  assert.equal((await loadTargetSubmissionCounts(transaction, "workspace-1", [])).size, 0);
  assert.equal(called, false);
});

test("loads read-only active reviewer context for only the current target page", async () => {
  let query;
  const reader = { assignment: { findMany: async (input) => {
    query = input;
    return [{ targetId: "target-1", reviewer: { id: "reviewer-1", user: { displayName: "Reviewer One", email: "reviewer@example.com" } } }];
  } } };
  const assignments = await loadTargetAssignments(reader, "workspace-1", ["target-1", "target-2"]);
  assert.deepEqual([...assignments], [["target-1", { membershipId: "reviewer-1", displayName: "Reviewer One", email: "reviewer@example.com" }]]);
  assert.deepEqual(query, {
    where: {
      organizationId: "workspace-1", targetId: { in: ["target-1", "target-2"] },
      target: { organizationId: "workspace-1", status: "ACTIVE", archivedAt: null },
      reviewer: { organizationId: "workspace-1", role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } },
    },
    orderBy: [{ targetId: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
    select: { targetId: true, reviewer: { select: { id: true, user: { select: { displayName: true, email: true } } } } },
  });
});

test("does not query reviewer context for an empty target page", async () => {
  let called = false;
  const reader = { assignment: { findMany: async () => { called = true; return []; } } };
  assert.equal((await loadTargetAssignments(reader, "workspace-1", [])).size, 0);
  assert.equal(called, false);
});
