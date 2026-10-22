import assert from "node:assert/strict";
import test from "node:test";
import { getNavigationForRole, canAccessWorkspacePath, workspacePathForRole, signInPathForRole } from "./workspace-access.ts";

test("reviewers only see progress, submissions, and their form links", () => {
  assert.deepEqual(getNavigationForRole("REVIEWER").map(({ href }) => href), ["/reviewer/progress", "/reviewer/submissions", "/reviewer/forms"]);
  assert.equal(canAccessWorkspacePath("/reviewer", "REVIEWER"), true);
  assert.equal(canAccessWorkspacePath("/reviewer/progress", "REVIEWER"), true);
  assert.equal(canAccessWorkspacePath("/reviewer/submissions/abc", "REVIEWER"), true);
  assert.equal(canAccessWorkspacePath("/admin/people", "REVIEWER"), false);
  assert.equal(canAccessWorkspacePath("/people", "REVIEWER"), false);
  assert.equal(canAccessWorkspacePath("/forms/new", "REVIEWER"), false);
  assert.equal(canAccessWorkspacePath("/team", "REVIEWER"), false);
  assert.equal(canAccessWorkspacePath("/settings", "REVIEWER"), false);
});

test("admins retain management pages and shared submissions", () => {
  for (const role of ["OWNER", "ADMIN"]) {
    assert.equal(canAccessWorkspacePath("/admin/people", role), true);
    assert.equal(canAccessWorkspacePath("/admin/forms/new", role), true);
    assert.equal(canAccessWorkspacePath("/admin/submissions/abc", role), true);
    assert.equal(canAccessWorkspacePath("/reviewer/forms", role), false);
  }
});

test("role-specific entry and sign-in routes never cross-link", () => {
  assert.equal(workspacePathForRole("/", "OWNER"), "/admin/overview");
  assert.equal(workspacePathForRole("/", "REVIEWER"), "/reviewer/progress");
  assert.equal(workspacePathForRole("/forms/123", "ADMIN"), "/admin/forms/123");
  assert.equal(workspacePathForRole("/my-link", "REVIEWER"), "/reviewer/forms");
  assert.equal(signInPathForRole("ADMIN"), "/admin/login");
  assert.equal(signInPathForRole("REVIEWER"), "/reviewer/login");
});
