import assert from "node:assert/strict";
import test from "node:test";
import { getNavigationForRole, canAccessWorkspacePath, workspacePathForRole, signInPathForRole, roleMatchesAudience, workspaceEntryPath, workspaceLoginPath } from "./workspace-access.ts";

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
    const navigation = getNavigationForRole(role);
    assert.ok(navigation.some((item) => item.href === "/admin/people" && item.label === "People"));
    assert.ok(navigation.some((item) => item.href === "/admin/team" && item.label === "Team access"));
    assert.equal(navigation.some((item) => item.label === "Review targets"), false);
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

test("session roles must match the panel audience before rendering any workspace shell", () => {
  assert.equal(roleMatchesAudience("OWNER", "admin"), true);
  assert.equal(roleMatchesAudience("ADMIN", "admin"), true);
  assert.equal(roleMatchesAudience("REVIEWER", "reviewer"), true);
  assert.equal(roleMatchesAudience("REVIEWER", "admin"), false);
  assert.equal(roleMatchesAudience("OWNER", "reviewer"), false);
});

test("workspace entry keeps a mismatched session in the requested panel's login flow", () => {
  assert.equal(workspaceEntryPath("admin", "OWNER"), "/admin/overview");
  assert.equal(workspaceEntryPath("reviewer", "REVIEWER"), "/reviewer/progress");
  assert.equal(workspaceEntryPath("admin", "REVIEWER"), "/admin/login");
  assert.equal(workspaceEntryPath("reviewer", "OWNER"), "/reviewer/login");
  assert.equal(workspaceEntryPath("admin"), "/admin/login");
});

test("login return paths are restricted to the requested role's workspace routes", () => {
  assert.equal(workspaceLoginPath("admin", "/admin/forms/123"), "/admin/login?returnTo=%2Fadmin%2Fforms%2F123");
  assert.equal(workspaceLoginPath("reviewer", "/reviewer/submissions/123"), "/reviewer/login?returnTo=%2Freviewer%2Fsubmissions%2F123");
  for (const unsafe of ["https://attacker.example", "//attacker.example", "/admin/team?next=https://attacker.example", "/reviewer/forms#external", "/admin\\team", "/reviewer/tools", "/admin/forms/123/nested"]) {
    assert.equal(workspaceLoginPath("admin", unsafe), "/admin/login");
  }
  assert.equal(workspaceLoginPath("reviewer", "/admin/team"), "/reviewer/login");
});
