import assert from "node:assert/strict";
import test from "node:test";
import { toMemberSummary } from "../../../dist/modules/members/member-summary.js";

test("member response includes only the safe membership and user summary", () => {
  const result = toMemberSummary({
    id: "member-id",
    organizationId: "org-id",
    userId: "user-id",
    role: "REVIEWER",
    status: "ACTIVE",
    passwordHash: "must-not-leak",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    user: { id: "user-id", email: "reviewer@example.com", displayName: "Reviewer", status: "ACTIVE", privateField: "must-not-leak" },
    _count: { assignments: 2, reviewLinks: 1 },
    privateField: "must-not-leak",
  });
  assert.deepEqual(result, {
    id: "member-id",
    organizationId: "org-id",
    userId: "user-id",
    role: "REVIEWER",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    user: { id: "user-id", email: "reviewer@example.com", displayName: "Reviewer", status: "ACTIVE" },
    assignedTargetCount: 2,
    linkCount: 1,
  });
  assert.equal("passwordHash" in result, false);
  assert.equal("privateField" in result, false);
  assert.equal("privateField" in result.user, false);
});
