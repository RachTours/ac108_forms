import assert from "node:assert/strict";
import test from "node:test";
import {
  apiErrorSchema,
  assignmentListResponseSchema,
  assignmentMutationResponseSchema,
  assignmentSetRequestSchema,
  invitationAcceptRequestSchema,
  listQuerySchema,
  passwordResetRequestSchema,
  sessionResponseSchema,
} from "../dist/index.js";

test("list query defaults are bounded and reject unknown filters", () => {
  assert.deepEqual(listQuerySchema.parse({}), { limit: 25 });
  assert.deepEqual(listQuerySchema.parse({ limit: "100", cursor: "abc" }), { limit: 100, cursor: "abc" });
  assert.equal(listQuerySchema.safeParse({ limit: "1000" }).success, false);
  assert.equal(listQuerySchema.safeParse({ cursor: "x", admin: "true" }).success, false);
});

test("assignment writes require an explicit reviewer and optimistic version", () => {
  const reviewerId = "8d493e2d-7500-4d5f-a148-05a7ff2127d0";
  assert.deepEqual(assignmentSetRequestSchema.parse({ reviewerId, expectedUpdatedAt: null }), { reviewerId, expectedUpdatedAt: null });
  assert.equal(assignmentSetRequestSchema.safeParse({ reviewerId }).success, false);
  assert.equal(assignmentSetRequestSchema.safeParse({ reviewerId, expectedUpdatedAt: null, organizationId: "attacker-controlled" }).success, false);
});

test("invitation and reset contracts bound secret and credential inputs", () => {
  assert.equal(invitationAcceptRequestSchema.safeParse({ token: "x".repeat(8193), displayName: "A", password: "a".repeat(20) }).success, false);
  assert.equal(invitationAcceptRequestSchema.safeParse({ token: "invite-token", displayName: "A", password: "short" }).success, false);
  const token = "a".repeat(48);
  assert.equal(invitationAcceptRequestSchema.safeParse({ token, email: "a@example.com", displayName: "A", password: "a".repeat(14) }).success, true);
  assert.equal(passwordResetRequestSchema.safeParse({ token, password: "a".repeat(14) }).success, true);
  assert.equal(passwordResetRequestSchema.safeParse({ token, password: "a".repeat(14), membershipId: "untrusted" }).success, false);
});

test("session and error response envelopes are strict and stable", () => {
  const session = {
    user: { id: "8d493e2d-7500-4d5f-a148-05a7ff2127d0", email: "a@example.com", displayName: "A" },
    organizationId: "e6c9e1b9-af95-45c3-82b7-4fe7e608a189",
    organizationName: "Workspace",
    membershipId: "29939b21-1d8b-4d94-980e-375d8972a205",
    role: "REVIEWER",
    csrfToken: "a".repeat(64),
  };
  assert.equal(sessionResponseSchema.safeParse(session).success, true);
  assert.equal(sessionResponseSchema.safeParse({ ...session, passwordHash: "must-not-leak" }).success, false);
  assert.equal(apiErrorSchema.safeParse({ error: { code: "ASSIGNMENT_CHANGED", message: "Refresh.", requestId: "request-1" } }).success, true);
  assert.equal(apiErrorSchema.safeParse({ error: { code: "x", message: "x", secret: "leak" } }).success, false);
});

test("assignment response schemas match the bounded target list and mutation envelopes", () => {
  const targetId = "8d493e2d-7500-4d5f-a148-05a7ff2127d0";
  const reviewerId = "e6c9e1b9-af95-45c3-82b7-4fe7e608a189";
  const assignment = { id: "29939b21-1d8b-4d94-980e-375d8972a205", reviewerId, updatedAt: "2026-01-01T00:00:00.000Z", reviewer: { displayName: "Reviewer", email: "reviewer@example.com" } };
  assert.equal(assignmentListResponseSchema.safeParse({ data: [{ id: targetId, displayName: "Target", email: null, assignment }], nextCursor: null, counts: { total: 1, assigned: 1, unassigned: 0 } }).success, true);
  const page = Array.from({ length: 101 }, (_, index) => ({ id: `8d493e2d-7500-4d5f-a148-${String(index).padStart(12, "0")}`, displayName: "Target", email: null, assignment: null }));
  assert.equal(assignmentListResponseSchema.safeParse({ data: page, nextCursor: null, counts: { total: 101, assigned: 0, unassigned: 101 } }).success, false);
  assert.equal(assignmentMutationResponseSchema.safeParse({ data: { id: "29939b21-1d8b-4d94-980e-375d8972a205", organizationId: "d7a22eb1-57f7-41d4-965d-c91c8ef2a31f", targetId, reviewerId, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, changed: true }).success, true);
});
