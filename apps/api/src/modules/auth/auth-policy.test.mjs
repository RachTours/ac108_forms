import assert from "node:assert/strict";
import test from "node:test";
import { authenticateMemberships, canRoleSignInAs } from "../../../dist/modules/auth/auth-policy.js";

test("admin sign-in accepts only owner and admin memberships", () => {
  assert.equal(canRoleSignInAs("admin", "OWNER"), true);
  assert.equal(canRoleSignInAs("admin", "ADMIN"), true);
  assert.equal(canRoleSignInAs("admin", "REVIEWER"), false);
});

test("reviewer sign-in accepts only reviewer memberships", () => {
  assert.equal(canRoleSignInAs("reviewer", "REVIEWER"), true);
  assert.equal(canRoleSignInAs("reviewer", "OWNER"), false);
  assert.equal(canRoleSignInAs("reviewer", "ADMIN"), false);
});

test("admin and reviewer memberships authenticate against independent password hashes", async () => {
  const memberships = [
    { role: "OWNER", passwordHash: "admin-only-password" },
    { role: "REVIEWER", passwordHash: "reviewer-only-password" },
  ];
  const verify = async (password, hash) => password === hash;
  assert.equal((await authenticateMemberships(memberships, "admin-only-password", verify, "reviewer")).length, 0);
  assert.equal((await authenticateMemberships(memberships, "reviewer-only-password", verify, "admin")).length, 0);
  assert.equal((await authenticateMemberships(memberships, "reviewer-only-password", verify, "reviewer")).length, 1);
  assert.equal((await authenticateMemberships(memberships, "admin-only-password", verify, "admin")).length, 1);
});
