import assert from "node:assert/strict";
import test from "node:test";
import { toMemberUpdateSummary } from "../../../dist/modules/members/member-update-summary.js";

test("membership update projection never returns credential or persistence-only fields", () => {
  const summary = toMemberUpdateSummary({
    id: "membership-id",
    organizationId: "organization-id",
    userId: "user-id",
    role: "REVIEWER",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    passwordHash: "must-not-leak",
    privateField: "must-not-leak",
  });

  assert.deepEqual(summary, {
    id: "membership-id",
    organizationId: "organization-id",
    userId: "user-id",
    role: "REVIEWER",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  assert.equal("passwordHash" in summary, false);
  assert.equal("privateField" in summary, false);
});
