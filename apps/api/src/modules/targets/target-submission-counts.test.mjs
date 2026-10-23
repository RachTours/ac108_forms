import assert from "node:assert/strict";
import test from "node:test";
import { countSubmissionsByTarget } from "../../../dist/modules/targets/target-submission-counts.js";

test("submission counts use Prisma aggregation scoped to the active organization and target page", async () => {
  let query;
  const counts = await countSubmissionsByTarget({ submission: {
    groupBy: async (input) => {
      query = input;
      return [
        { targetId: "target-a", _count: { _all: 2 } },
        { targetId: "target-b", _count: { _all: 1 } },
      ];
    },
  } }, "org-a", ["target-a", "target-b"]);

  assert.deepEqual(Object.fromEntries(counts), { "target-a": 2, "target-b": 1 });
  assert.deepEqual(query.by, ["targetId"]);
  assert.equal(query.where.organizationId, "org-a");
  assert.equal(query.where.archivedAt, null);
  assert.deepEqual(query.where.targetId, { in: ["target-a", "target-b"] });
});

test("empty target pages do not make a database request", async () => {
  const counts = await countSubmissionsByTarget({ submission: {
    groupBy: async () => { throw new Error("should not query an empty target page"); },
  } }, "org-a", []);

  assert.equal(counts.size, 0);
});
