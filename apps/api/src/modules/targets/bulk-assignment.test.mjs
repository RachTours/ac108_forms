import assert from "node:assert/strict";
import test from "node:test";
import { assignTargets } from "../../../dist/modules/targets/bulk-assignment.js";

const orgId = "org-a";
const targetIds = ["target-1", "target-2"];

function createFixture({ targets = targetIds.map((id) => ({ id, organizationId: orgId, status: "ACTIVE", archivedAt: null })), reviewer = { id: "reviewer-1", organizationId: orgId, role: "REVIEWER", status: "ACTIVE" }, failTargetId } = {}) {
  const state = { assignments: new Map(), audit: [] };
  const tx = {
    reviewTarget: { findMany: async ({ where }) => targets.filter((target) => where.id.in.includes(target.id) && target.organizationId === where.organizationId && target.status === where.status && target.archivedAt === null).map(({ id }) => ({ id })) },
    membership: { findFirst: async ({ where }) => reviewer && reviewer.id === where.id && reviewer.organizationId === where.organizationId && reviewer.role === where.role && reviewer.status === where.status ? { id: reviewer.id } : null },
    assignment: { upsert: async ({ where, create, update }) => {
      if (where.organizationId_targetId.targetId === failTargetId) throw new Error("simulated database failure");
      const key = `${where.organizationId_targetId.organizationId}:${where.organizationId_targetId.targetId}`;
      const saved = { id: state.assignments.get(key)?.id ?? `assignment-${where.organizationId_targetId.targetId}`, targetId: where.organizationId_targetId.targetId, reviewerId: state.assignments.has(key) ? update.reviewerId : create.reviewerId };
      state.assignments.set(key, saved); return saved;
    } },
    auditEvent: { createMany: async ({ data }) => { state.audit.push(...data); } },
  };
  async function transaction(operation) {
    const snapshot = structuredClone({ assignments: [...state.assignments], audit: state.audit });
    try { return await operation(tx); } catch (error) { state.assignments = new Map(snapshot.assignments); state.audit = snapshot.audit; throw error; }
  }
  return { state, tx, transaction };
}

test("bulk assignment rejects targets from another organization without writes", async () => {
  const fixture = createFixture({ targets: [{ id: "target-1", organizationId: "org-other", status: "ACTIVE", archivedAt: null }, targetIds[1] && { id: targetIds[1], organizationId: orgId, status: "ACTIVE", archivedAt: null }] });
  await assert.rejects(fixture.transaction((tx) => assignTargets(tx, { organizationId: orgId, actorId: "owner-1", reviewerId: "reviewer-1", targetIds })), { code: "TARGET_NOT_FOUND" });
  assert.equal(fixture.state.assignments.size, 0);
  assert.equal(fixture.state.audit.length, 0);
});

test("bulk assignment rejects inactive reviewers before writing any target", async () => {
  const fixture = createFixture({ reviewer: { id: "reviewer-1", organizationId: orgId, role: "REVIEWER", status: "ARCHIVED" } });
  await assert.rejects(fixture.transaction((tx) => assignTargets(tx, { organizationId: orgId, actorId: "owner-1", reviewerId: "reviewer-1", targetIds })), { code: "REVIEWER_NOT_FOUND" });
  assert.equal(fixture.state.assignments.size, 0);
  assert.equal(fixture.state.audit.length, 0);
});

test("bulk assignment transaction rolls back writes if any upsert fails", async () => {
  const fixture = createFixture({ failTargetId: "target-2" });
  await assert.rejects(fixture.transaction((tx) => assignTargets(tx, { organizationId: orgId, actorId: "owner-1", reviewerId: "reviewer-1", targetIds })), /simulated database failure/);
  assert.equal(fixture.state.assignments.size, 0);
  assert.equal(fixture.state.audit.length, 0);
});

test("retrying bulk assignment keeps one assignment per target and records successful operation", async () => {
  const fixture = createFixture();
  const input = { organizationId: orgId, actorId: "owner-1", reviewerId: "reviewer-1", targetIds };
  const first = await fixture.transaction((tx) => assignTargets(tx, input));
  const retry = await fixture.transaction((tx) => assignTargets(tx, input));
  assert.equal(first.length, 2);
  assert.equal(retry.length, 2);
  assert.equal(fixture.state.assignments.size, 2);
  assert.equal(fixture.state.audit.length, 4);
});
