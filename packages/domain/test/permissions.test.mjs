import assert from "node:assert/strict";
import test from "node:test";
import { authorize } from "../dist/permissions.js";

const base = { organizationId: "org-a", requestedOrganizationId: "org-a", membershipStatus: "ACTIVE", role: "OWNER" };

test("permission matrix grants owner/admin workspace reads and restricts reviewer operations", () => {
  for (const role of ["OWNER", "ADMIN"]) {
    assert.equal(authorize({ ...base, role, resource: "targets", action: "read" }).allowed, true);
    assert.equal(authorize({ ...base, role, resource: "assignments", action: "manage" }).allowed, true);
    assert.equal(authorize({ ...base, role, resource: "settings", action: "manage" }).allowed, true);
  }
  assert.equal(authorize({ ...base, role: "REVIEWER", resource: "targets", action: "read" }).allowed, false);
  assert.equal(authorize({ ...base, role: "REVIEWER", resource: "reviewWork", action: "readOwn", resourceMembershipId: "member-a", membershipId: "member-a" }).allowed, true);
  assert.equal(authorize({ ...base, role: "REVIEWER", resource: "reviewWork", action: "readOwn", resourceMembershipId: "member-b", membershipId: "member-a" }).reason, "RESOURCE_SCOPE_MISMATCH");
});

test("authorization denies inactive membership and cross-organization resource access before role grants", () => {
  assert.equal(authorize({ ...base, membershipStatus: "ARCHIVED", resource: "targets", action: "read" }).reason, "MEMBERSHIP_INACTIVE");
  assert.equal(authorize({ ...base, requestedOrganizationId: "org-b", resource: "targets", action: "read" }).reason, "TENANT_MISMATCH");
});

test("sensitive member operations are owner-only and public submit has no authenticated grant", () => {
  assert.equal(authorize({ ...base, role: "ADMIN", resource: "members", action: "grantAdmin" }).reason, "ROLE_FORBIDDEN");
  assert.equal(authorize({ ...base, resource: "publicReview", action: "submit" }).reason, "ROLE_FORBIDDEN");
});
