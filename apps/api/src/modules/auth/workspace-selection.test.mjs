import assert from "node:assert/strict";
import test from "node:test";
import { chooseWorkspaceMembership } from "../../../dist/modules/auth/workspace-selection.js";

const memberships = [
  { role: "REVIEWER", organization: { id: "1", name: "Review A", slug: "review-a" } },
  { role: "ADMIN", organization: { id: "2", name: "Review B", slug: "review-b" } },
];

test("a single workspace is selected automatically", () => {
  assert.equal(chooseWorkspaceMembership([memberships[0]]).membership.organization.slug, "review-a");
});

test("multiple workspaces require selection after the password is verified", () => {
  assert.deepEqual(chooseWorkspaceMembership(memberships), { kind: "choose", memberships });
  assert.equal(chooseWorkspaceMembership(memberships, "review-b").membership.organization.slug, "review-b");
  assert.equal(chooseWorkspaceMembership(memberships, "other").kind, "missing");
});
