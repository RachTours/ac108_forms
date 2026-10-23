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

test("sensitive member operations are owner-only", () => {
  assert.equal(authorize({ ...base, role: "ADMIN", resource: "members", action: "grantAdmin" }).reason, "ROLE_FORBIDDEN");
  assert.equal(authorize({ ...base, role: "ADMIN", resource: "members", action: "permanentDelete" }).reason, "ROLE_FORBIDDEN");
  assert.equal(authorize({ ...base, role: "OWNER", resource: "members", action: "permanentDelete" }).allowed, true);
});

test("an active public review credential permits only public review reads and submissions", () => {
  const publicCredential = {
    role: "PUBLIC",
    organizationId: "org-a",
    requestedOrganizationId: "org-a",
    publicCredentialStatus: "ACTIVE",
  };

  assert.equal(authorize({ ...publicCredential, resource: "publicReview", action: "read" }).allowed, true);
  assert.equal(authorize({ ...publicCredential, resource: "publicReview", action: "submit" }).allowed, true);
  assert.equal(authorize({ ...publicCredential, resource: "targets", action: "read" }).reason, "ROLE_FORBIDDEN");
  assert.equal(authorize({ ...publicCredential, resource: "publicReview", action: "submit", publicCredentialStatus: "INACTIVE" }).reason, "PUBLIC_CREDENTIAL_INACTIVE");
  assert.equal(authorize({ ...publicCredential, resource: "publicReview", action: "read", requestedOrganizationId: "org-b" }).reason, "TENANT_MISMATCH");
});

test("reviewer link revocation is scoped to the caller while admins can revoke workspace links", () => {
  const reviewer = { ...base, role: "REVIEWER", membershipId: "reviewer-a", resource: "reviewLinks", action: "manageOwn" };
  assert.equal(authorize({ ...reviewer, resourceMembershipId: "reviewer-a" }).allowed, true);
  assert.equal(authorize({ ...reviewer, resourceMembershipId: "reviewer-b" }).reason, "RESOURCE_SCOPE_MISMATCH");
  assert.equal(authorize({ ...base, role: "ADMIN", resource: "reviewLinks", action: "archive", resourceMembershipId: "reviewer-b" }).allowed, true);
  assert.equal(authorize({ ...base, role: "REVIEWER", membershipId: "reviewer-a", resource: "reviewLinks", action: "archive", resourceMembershipId: "reviewer-a" }).reason, "ROLE_FORBIDDEN");
});

test("every declared resource and action has an explicit owner/admin/reviewer/public decision", () => {
  const expected = new Map([
    ["workspace:read", ["OWNER", "ADMIN"]],
    ["workspace:manage", ["OWNER", "ADMIN"]],
    ["members:read", ["OWNER", "ADMIN"]], ["members:create", ["OWNER", "ADMIN"]], ["members:update", ["OWNER", "ADMIN"]], ["members:archive", ["OWNER", "ADMIN"]], ["members:grantAdmin", ["OWNER"]], ["members:permanentDelete", ["OWNER"]],
    ["targets:read", ["OWNER", "ADMIN"]], ["targets:create", ["OWNER", "ADMIN"]], ["targets:update", ["OWNER", "ADMIN"]], ["targets:archive", ["OWNER", "ADMIN"]],
    ["assignments:read", ["OWNER", "ADMIN"]], ["assignments:manage", ["OWNER", "ADMIN"]],
    ["reviewLinks:read", ["OWNER", "ADMIN"]], ["reviewLinks:create", ["OWNER", "ADMIN"]], ["reviewLinks:archive", ["OWNER", "ADMIN"]], ["reviewLinks:readOwn", ["REVIEWER"]], ["reviewLinks:manageOwn", ["REVIEWER"]],
    ["forms:read", ["OWNER", "ADMIN"]], ["forms:create", ["OWNER", "ADMIN"]], ["forms:update", ["OWNER", "ADMIN"]], ["forms:archive", ["OWNER", "ADMIN"]], ["forms:publish", ["OWNER", "ADMIN"]],
    ["submissions:read", ["OWNER", "ADMIN"]], ["submissions:update", ["OWNER", "ADMIN"]], ["submissions:archive", ["OWNER", "ADMIN"]],
    ["settings:read", ["OWNER", "ADMIN"]], ["settings:manage", ["OWNER", "ADMIN"]], ["audit:read", ["OWNER", "ADMIN"]],
    ["reviewWork:readOwn", ["REVIEWER"]], ["reviewWork:submit", ["REVIEWER"]],
    ["publicReview:read", ["PUBLIC"]], ["publicReview:submit", ["PUBLIC"]],
  ]);
  const resources = ["workspace", "members", "targets", "assignments", "reviewLinks", "forms", "submissions", "settings", "audit", "reviewWork", "publicReview"];
  const actions = ["read", "create", "update", "archive", "manage", "publish", "readOwn", "manageOwn", "submit", "grantAdmin", "permanentDelete"];

  for (const resource of resources) {
    for (const action of actions) {
      for (const role of ["OWNER", "ADMIN", "REVIEWER", "PUBLIC"]) {
        const key = `${resource}:${action}`;
        const expectedAllowed = expected.get(key)?.includes(role) ?? false;
        const subject = role === "PUBLIC"
          ? { role, organizationId: "org-a", requestedOrganizationId: "org-a", publicCredentialStatus: "ACTIVE" }
          : { ...base, role, ...(["reviewWork", "reviewLinks"].includes(resource) ? { membershipId: "member-a", resourceMembershipId: "member-a" } : {}) };
        const result = authorize({ ...subject, resource, action });
        assert.equal(result.allowed, expectedAllowed, `${role} ${resource}:${action}`);
      }
    }
  }
});
