import assert from "node:assert/strict";
import test from "node:test";
import { buildAssignmentListUrl, readAssignmentFilters } from "./assignment-view.ts";

test("assignment search is sent to the server together with reviewer and state filters", () => {
  assert.equal(buildAssignmentListUrl({ search: " Amina ", state: "assigned", reviewerId: "reviewer-id", cursor: "page-cursor", limit: 50 }), "/assignments?search=Amina&state=assigned&reviewerId=reviewer-id&cursor=page-cursor&limit=50");
});

test("assignment filters can be restored from a URL and invalid states fall back safely", () => {
  assert.deepEqual(readAssignmentFilters("?search=Alex&state=unassigned&reviewerId=r1"), { search: "Alex", state: "unassigned", reviewerId: "r1" });
  assert.deepEqual(readAssignmentFilters("?state=completed"), { search: "", state: "all", reviewerId: "" });
});

test("assignment selectors only offer active reviewer memberships with active user accounts", async () => {
  const assignmentView = await import("./assignment-view.ts");
  assert.equal(typeof assignmentView.selectEligibleReviewers, "function");
  const rows = [
    { id: "active", role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } },
    { id: "archived-membership", role: "REVIEWER", status: "ARCHIVED", user: { status: "ACTIVE" } },
    { id: "archived-user", role: "REVIEWER", status: "ACTIVE", user: { status: "ARCHIVED" } },
    { id: "admin", role: "ADMIN", status: "ACTIVE", user: { status: "ACTIVE" } },
  ];
  assert.deepEqual(assignmentView.selectEligibleReviewers(rows).map((row) => row.id), ["active"]);
});
