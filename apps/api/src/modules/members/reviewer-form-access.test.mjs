import assert from "node:assert/strict";
import test from "node:test";
import { reviewerFormScope, assertReviewerFormAccess } from "../../../dist/modules/members/reviewer-form-access.js";

test("legacy reviewers keep access while configured reviewers require an explicit workspace grant", async () => {
  const calls = [];
  let configured = false;
  const db = { membership: { findFirst: async (query) => { calls.push(query); return { formAssignmentsConfigured: configured }; } } };
  assert.deepEqual(await reviewerFormScope(db, "org-a", "reviewer-a"), {});
  configured = true;
  assert.deepEqual(await reviewerFormScope(db, "org-a", "reviewer-a"), { reviewerFormGrants: { some: { organizationId: "org-a", reviewerId: "reviewer-a" } } });
  assert.deepEqual(calls[0].where, { id: "reviewer-a", organizationId: "org-a", role: "REVIEWER", status: "ACTIVE" });
});

test("cross-workspace and missing memberships fail closed", async () => {
  const db = { membership: { findFirst: async () => null } };
  await assert.rejects(reviewerFormScope(db, "other-org", "reviewer-a"), (error) => error.status === 404 && error.code === "REVIEWER_NOT_FOUND");
});

test("unassigned, draft and archived forms cannot be used through published reviewer links", async () => {
  let formQuery;
  const db = { membership: { findFirst: async () => ({ formAssignmentsConfigured: true }) }, form: { findFirst: async (query) => { formQuery = query; return null; } } };
  await assert.rejects(assertReviewerFormAccess(db, "org-a", "reviewer-a", "form-b"), (error) => error.status === 404 && error.code === "FORM_NOT_FOUND");
  assert.deepEqual(formQuery.where, { id: "form-b", organizationId: "org-a", status: "PUBLISHED", archivedAt: null, currentPublishedId: { not: null }, reviewerFormGrants: { some: { organizationId: "org-a", reviewerId: "reviewer-a" } } });
});
