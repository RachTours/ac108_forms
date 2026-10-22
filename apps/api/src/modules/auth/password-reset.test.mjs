import assert from "node:assert/strict";
import test from "node:test";
import { assertPasswordResetTokenUsable, createPasswordResetToken, hashPasswordResetToken } from "../../../dist/modules/auth/password-reset.js";

const base = (overrides = {}) => ({
  userId: "user-a",
  membershipId: "membership-a",
  organizationId: "org-a",
  expiresAt: new Date("2026-10-22T12:30:00.000Z"),
  consumedAt: null,
  revokedAt: null,
  ...overrides,
});

test("reset token is opaque, hashable, and expires after the configured lifetime", () => {
  const issuedAt = new Date("2026-10-22T12:00:00.000Z");
  const generated = createPasswordResetToken(issuedAt);
  assert.equal(generated.token.length, 43);
  assert.equal(generated.tokenHash.length, 64);
  assert.notEqual(generated.token, generated.tokenHash);
  assert.equal(hashPasswordResetToken(generated.token), generated.tokenHash);
  assert.equal(generated.expiresAt.toISOString(), "2026-10-22T12:30:00.000Z");
});

test("active reset token is usable only for its target member and workspace", () => {
  assert.doesNotThrow(() => assertPasswordResetTokenUsable(base(), { userId: "user-a", membershipId: "membership-a", organizationId: "org-a" }, new Date("2026-10-22T12:15:00.000Z")));
  assert.throws(() => assertPasswordResetTokenUsable(base(), { userId: "other", membershipId: "membership-a", organizationId: "org-a" }, new Date("2026-10-22T12:15:00.000Z")), (error) => error.code === "PASSWORD_RESET_INVALID");
  assert.throws(() => assertPasswordResetTokenUsable(base(), { userId: "user-a", membershipId: "membership-a", organizationId: "other" }, new Date("2026-10-22T12:15:00.000Z")), (error) => error.code === "PASSWORD_RESET_INVALID");
});

test("expired, consumed, and revoked reset tokens fail closed", () => {
  const target = { userId: "user-a", membershipId: "membership-a", organizationId: "org-a" };
  const now = new Date("2026-10-22T12:30:00.000Z");
  for (const token of [
    base({ expiresAt: new Date(now.getTime() - 1) }),
    base({ consumedAt: new Date(now.getTime() - 1) }),
    base({ revokedAt: new Date(now.getTime() - 1) }),
  ]) {
    assert.throws(() => assertPasswordResetTokenUsable(token, target, now), (error) => error.code === "PASSWORD_RESET_INVALID");
  }
});
