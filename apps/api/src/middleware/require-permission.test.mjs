import assert from "node:assert/strict";
import test from "node:test";
import { requirePermission } from "../../dist/middleware/require-permission.js";

function invoke(handler, auth) {
  let error;
  let continued = false;
  handler({ auth }, {}, (nextError) => { error = nextError; continued = !nextError; });
  return { error, continued };
}

test("assignment permission middleware delegates owner/admin grants to the domain policy", () => {
  const handler = requirePermission("assignments", "manage");
  assert.equal(invoke(handler, { role: "OWNER", organizationId: "org-a", membershipId: "owner" }).continued, true);
  assert.equal(invoke(handler, { role: "ADMIN", organizationId: "org-a", membershipId: "admin" }).continued, true);
  const denied = invoke(handler, { role: "REVIEWER", organizationId: "org-a", membershipId: "reviewer" });
  assert.equal(denied.error.status, 403);
  assert.equal(denied.error.code, "FORBIDDEN");
});

test("target operations use their explicit domain permissions", () => {
  const cases = [
    ["targets", "read"], ["targets", "create"], ["targets", "update"], ["targets", "archive"],
    ["assignments", "read"], ["assignments", "manage"], ["settings", "manage"], ["audit", "read"], ["workspace", "manage"],
  ];
  for (const [resource, action] of cases) {
    for (const role of ["OWNER", "ADMIN"]) {
      assert.equal(invoke(requirePermission(resource, action), { role, organizationId: "org-a", membershipId: "member-a" }).continued, true, `${role} ${resource}:${action}`);
    }
    const denied = invoke(requirePermission(resource, action), { role: "REVIEWER", organizationId: "org-a", membershipId: "member-r" });
    assert.equal(denied.error.status, 403, `reviewer ${resource}:${action}`);
  }
});

test("all form API operations stay owner/admin only so reviewers cannot read drafts", () => {
  for (const action of ["read", "create", "update", "publish", "archive"]) {
    for (const role of ["OWNER", "ADMIN"]) {
      assert.equal(invoke(requirePermission("forms", action), { role, organizationId: "org-a", membershipId: `${role}-a` }).continued, true, `${role} forms:${action}`);
    }
    const denied = invoke(requirePermission("forms", action), { role: "REVIEWER", organizationId: "org-a", membershipId: "reviewer-a" });
    assert.equal(denied.error.status, 403, `reviewer forms:${action}`);
  }
});

test("submission archive operations are owner/admin only while reviewer work remains separately scoped", () => {
  for (const action of ["read", "update", "archive"]) {
    for (const role of ["OWNER", "ADMIN"]) {
      assert.equal(invoke(requirePermission("submissions", action), { role, organizationId: "org-a", membershipId: `${role}-a` }).continued, true, `${role} submissions:${action}`);
    }
    const denied = invoke(requirePermission("submissions", action), { role: "REVIEWER", organizationId: "org-a", membershipId: "reviewer-a" });
    assert.equal(denied.error.status, 403, `reviewer submissions:${action}`);
  }
  assert.equal(invoke(requirePermission("reviewWork", "readOwn"), { role: "REVIEWER", organizationId: "org-a", membershipId: "reviewer-a" }).continued, true);
});

test("member lifecycle permissions separate owner-only permanent deletion", () => {
  for (const action of ["read", "create", "update", "archive"]) {
    for (const role of ["OWNER", "ADMIN"]) {
      assert.equal(invoke(requirePermission("members", action), { role, organizationId: "org-a", membershipId: `${role}-a` }).continued, true);
    }
    assert.equal(invoke(requirePermission("members", action), { role: "REVIEWER", organizationId: "org-a", membershipId: "reviewer-a" }).error.status, 403);
  }
  assert.equal(invoke(requirePermission("members", "grantAdmin"), { role: "ADMIN", organizationId: "org-a", membershipId: "admin-a" }).error.status, 403);
  assert.equal(invoke(requirePermission("members", "permanentDelete"), { role: "ADMIN", organizationId: "org-a", membershipId: "admin-a" }).error.status, 403);
  assert.equal(invoke(requirePermission("members", "permanentDelete"), { role: "OWNER", organizationId: "org-a", membershipId: "owner-a" }).continued, true);
});

test("permission middleware rejects requests without an authenticated session", () => {
  const result = invoke(requirePermission("assignments", "read"), undefined);
  assert.equal(result.error.status, 401);
  assert.equal(result.error.code, "UNAUTHENTICATED");
});
