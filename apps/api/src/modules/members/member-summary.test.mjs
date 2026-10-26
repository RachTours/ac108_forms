import assert from "node:assert/strict";
import test from "node:test";
import { reviewerMemberSummarySchema } from "@reviewroom/contracts";
import { toMemberSummary } from "../../../dist/modules/members/member-summary.js";

test("member response includes only the safe membership and user summary", () => {
  const result = toMemberSummary({
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "22222222-2222-4222-8222-222222222222",
    userId: "33333333-3333-4333-8333-333333333333",
    role: "REVIEWER",
    status: "ACTIVE",
    passwordHash: "must-not-leak",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    user: { id: "33333333-3333-4333-8333-333333333333", email: "reviewer@example.com", displayName: "Reviewer", status: "ACTIVE", privateField: "must-not-leak" },
    _count: { assignments: 2, reviewLinks: 1 },
    privateField: "must-not-leak",
  });
  assert.deepEqual(result, {
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "22222222-2222-4222-8222-222222222222",
    userId: "33333333-3333-4333-8333-333333333333",
    role: "REVIEWER",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    user: { id: "33333333-3333-4333-8333-333333333333", email: "reviewer@example.com", displayName: "Reviewer", status: "ACTIVE" },
    assignedTargetCount: 2,
    linkCount: 1,
    group: null,
    submissionGoalOverride: null,
    formAssignmentsConfigured: false,
    assignedFormIds: [],
  });
  assert.equal("passwordHash" in result, false);
  assert.equal("privateField" in result, false);
  assert.equal("privateField" in result.user, false);
  assert.equal(reviewerMemberSummarySchema.safeParse(result).success, true, "serialized member summary must satisfy the shared API response contract");
});
