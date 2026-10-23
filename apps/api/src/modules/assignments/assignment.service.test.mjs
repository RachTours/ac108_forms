import assert from "node:assert/strict";
import test from "node:test";
import { listAssignments, removeAssignment, setAssignment } from "../../../dist/modules/assignments/assignment.service.js";

const organizationId = "org-a";
const targetId = "target-a";
const reviewerId = "reviewer-a";
const actorId = "admin-a";

function fixture({ assignment = null, target = { id: targetId }, reviewer = { id: reviewerId } } = {}) {
  const state = { assignment: assignment && { id: "assignment-a", organizationId, targetId, reviewerId: "reviewer-old", createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: new Date("2026-01-01T00:00:00.000Z"), ...assignment }, audits: [] };
  const tx = {
    $queryRaw: async () => [],
    reviewTarget: { findFirst: async ({ where }) => where.id === targetId && where.organizationId === organizationId && target ? target : null },
    membership: { findFirst: async ({ where }) => where.id === reviewerId && where.organizationId === organizationId && reviewer ? reviewer : null },
    assignment: {
      findUnique: async () => state.assignment,
      create: async ({ data }) => {
        if (state.assignment) throw Object.assign(new Error("unique"), { code: "P2002" });
        state.assignment = { id: "assignment-a", ...data, createdAt: new Date(), updatedAt: new Date() };
        return state.assignment;
      },
      updateMany: async ({ where, data }) => {
        if (!state.assignment || where.id !== state.assignment.id || (where.updatedAt && +where.updatedAt !== +state.assignment.updatedAt)) return { count: 0 };
        Object.assign(state.assignment, data, { updatedAt: new Date("2026-01-02T00:00:00.000Z") });
        return { count: 1 };
      },
      deleteMany: async ({ where }) => {
        if (!state.assignment || where.id !== state.assignment.id || (where.updatedAt && +where.updatedAt !== +state.assignment.updatedAt)) return { count: 0 };
        state.assignment = null;
        return { count: 1 };
      },
    },
    auditEvent: { create: async ({ data }) => { state.audits.push(data); } },
  };
  return { tx, state };
}

test("assignment retry for the current reviewer is idempotent and does not add another audit event", async () => {
  const current = { reviewerId, updatedAt: new Date("2026-01-01T00:00:00.000Z") };
  const { tx, state } = fixture({ assignment: current });
  const result = await setAssignment(tx, { organizationId, actorId, targetId, reviewerId, expectedUpdatedAt: new Date("2025-12-31T00:00:00.000Z") });
  assert.equal(result.changed, false);
  assert.equal(state.assignment.reviewerId, reviewerId);
  assert.equal(state.audits.length, 0);
});

test("reviewer and state filters are combined instead of overwriting one another", async () => {
  const targetQueries = [];
  const transaction = { reviewTarget: {
    findMany: async ({ where }) => { targetQueries.push(where); return []; },
    count: async ({ where }) => { targetQueries.push(where); return 0; },
  } };
  await listAssignments(transaction, { organizationId, reviewerId, state: "unassigned", search: "", limit: 25 });
  assert.ok(targetQueries.every((where) => Array.isArray(where.AND)), "combined filters must stay separate in AND clauses");
  const pageFilter = JSON.stringify(targetQueries[0]);
  assert.match(pageFilter, new RegExp(`"reviewerId":"${reviewerId}"`));
  assert.match(pageFilter, new RegExp(`"none":\\{"organizationId":"${organizationId}"`));
  const assignedCountFilter = JSON.stringify(targetQueries[2]);
  assert.match(assignedCountFilter, new RegExp(`"reviewerId":"${reviewerId}"`));
  assert.ok(assignedCountFilter.includes('"some":'));
});

test("reassignment requires the displayed version and records one audit event", async () => {
  const version = new Date("2026-01-01T00:00:00.000Z");
  const { tx, state } = fixture({ assignment: { reviewerId: "reviewer-old", updatedAt: version } });
  const result = await setAssignment(tx, { organizationId, actorId, targetId, reviewerId, expectedUpdatedAt: version });
  assert.equal(result.changed, true);
  assert.equal(state.assignment.reviewerId, reviewerId);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].metadata.previousReviewerId, "reviewer-old");
});

test("an assignment left by a now-inactive reviewer can be replaced from the unassigned view", async () => {
  const version = new Date("2026-01-01T00:00:00.000Z");
  const { tx, state } = fixture({ assignment: { reviewerId: "inactive-reviewer", updatedAt: version } });
  const result = await setAssignment(tx, { organizationId, actorId, targetId, reviewerId, expectedUpdatedAt: null });
  assert.equal(result.changed, true);
  assert.equal(state.assignment.reviewerId, reviewerId);
  assert.equal(state.audits[0].metadata.previousReviewerId, "inactive-reviewer");
});

test("stale reassignment is rejected without overwriting the newer assignment", async () => {
  const { tx, state } = fixture({ assignment: { reviewerId: "reviewer-newer", updatedAt: new Date("2026-01-02T00:00:00.000Z") } });
  await assert.rejects(setAssignment(tx, { organizationId, actorId, targetId, reviewerId, expectedUpdatedAt: new Date("2026-01-01T00:00:00.000Z") }), { code: "ASSIGNMENT_CHANGED" });
  assert.equal(state.assignment.reviewerId, "reviewer-newer");
  assert.equal(state.audits.length, 0);
});

test("assignment rejects inactive or cross-workspace targets and reviewers", async () => {
  const inactive = fixture({ target: null });
  await assert.rejects(setAssignment(inactive.tx, { organizationId, actorId, targetId, reviewerId, expectedUpdatedAt: null }), { code: "TARGET_NOT_FOUND" });
  const invalidReviewer = fixture({ reviewer: null });
  await assert.rejects(setAssignment(invalidReviewer.tx, { organizationId, actorId, targetId, reviewerId, expectedUpdatedAt: null }), { code: "REVIEWER_NOT_FOUND" });
});

test("unassign is retry-safe and only audits an actual removal", async () => {
  const { tx, state } = fixture({ assignment: { updatedAt: new Date("2026-01-01T00:00:00.000Z") } });
  assert.deepEqual(await removeAssignment(tx, { organizationId, actorId, targetId, expectedUpdatedAt: new Date("2026-01-01T00:00:00.000Z") }), { removed: true });
  assert.equal(state.assignment, null);
  assert.equal(state.audits.length, 1);
  assert.deepEqual(await removeAssignment(tx, { organizationId, actorId, targetId, expectedUpdatedAt: null }), { removed: false });
  assert.equal(state.audits.length, 1);
});
