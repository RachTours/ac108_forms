import assert from "node:assert/strict";
import test from "node:test";
import { activeReviewers } from "./available-reviewers.ts";

test("assignment choices contain only active reviewer memberships", () => {
  const members = [
    { id: "reviewer", role: "REVIEWER", status: "ACTIVE", user: { displayName: "Reviewer", email: "reviewer@example.com" } },
    { id: "admin", role: "ADMIN", status: "ACTIVE", user: { displayName: "Admin", email: "admin@example.com" } },
    { id: "removed", role: "REVIEWER", status: "ARCHIVED", user: { displayName: "Removed", email: "removed@example.com" } },
  ];
  assert.deepEqual(activeReviewers(members).map((member) => member.id), ["reviewer"]);
});
