import assert from "node:assert/strict";
import test from "node:test";
import { parseInvitationAcceptanceInput, resolveInvitationIdentity } from "../../../dist/modules/members/invitation-acceptance.js";

const invitation = { email: "Reviewer@Example.com", displayName: "Reviewer" };

test("uses the invited email and normalizes its case", () => {
  assert.deepEqual(resolveInvitationIdentity(invitation, { password: "p".repeat(14) }), {
    email: "reviewer@example.com", displayName: "Reviewer",
  });
});

test("rejects an email that differs from the invitation identity", () => {
  assert.throws(() => resolveInvitationIdentity(invitation, {
    email: "other@example.com", password: "p".repeat(14),
  }), (error) => error.code === "INVITATION_EMAIL_MISMATCH");
});

test("requires both identity fields when the invitation is unbound", () => {
  assert.throws(() => resolveInvitationIdentity({ email: null, displayName: null }, {
    password: "p".repeat(14),
  }), (error) => error.code === "IDENTITY_REQUIRED");
});

test("rejects malformed or extra invitation acceptance request fields", () => {
  assert.throws(() => parseInvitationAcceptanceInput({ email: "bad", password: "p".repeat(14) }));
  assert.throws(() => parseInvitationAcceptanceInput({ password: "p".repeat(14), role: "OWNER" }));
  assert.doesNotThrow(() => parseInvitationAcceptanceInput({ password: "p".repeat(14), email: "" }));
});
