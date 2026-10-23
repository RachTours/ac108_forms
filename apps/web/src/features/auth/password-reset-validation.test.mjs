import assert from "node:assert/strict";
import test from "node:test";
import { validatePasswordResetInput } from "./password-reset-validation.ts";

test("normalizes a valid reset email and accepts the bounded reset payload", () => {
  const parsed = validatePasswordResetInput({ email: "  ADMIN@example.com  ", token: "t".repeat(48), password: "p".repeat(14) });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.email, "ADMIN@example.com");
});

test("rejects overlong credentials, short tokens, and unknown reset fields", () => {
  assert.equal(validatePasswordResetInput({ email: "admin@example.com", token: "t".repeat(39), password: "p".repeat(14) }).success, false);
  assert.equal(validatePasswordResetInput({ email: "admin@example.com", token: "t".repeat(48), password: "p".repeat(1025) }).success, false);
  assert.equal(validatePasswordResetInput({ email: "admin@example.com", token: "t".repeat(48), password: "p".repeat(14), membershipId: "attacker" }).success, false);
});
