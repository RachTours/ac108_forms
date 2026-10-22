import assert from "node:assert/strict";
import test from "node:test";
import { permanentlyDeleteSubmission, setSubmissionArchived } from "../../../dist/modules/submissions/submission-lifecycle.js";

function fixture(records = [{ id: "submission-1", organizationId: "org-1", archivedAt: null }]) {
  const events = [];
  const tx = {
    findSubmission: async ({ submissionId, organizationId, state }) => records.find((row) => row.id === submissionId && row.organizationId === organizationId && (state === "any" || (state === "archived" ? row.archivedAt !== null : row.archivedAt === null))) ?? null,
    updateArchivedAt: async (id, archivedAt) => { const row = records.find((item) => item.id === id); row.archivedAt = archivedAt; events.push({ type: "archive", id, archivedAt }); },
    deleteSubmission: async (id) => { const index = records.findIndex((row) => row.id === id); records.splice(index, 1); events.push({ type: "delete", id }); },
    writeAudit: async (entry) => { events.push({ type: "audit", ...entry }); },
  };
  return { tx, records, events };
}

test("restores only an archived submission and records the restore atomically", async () => {
  const state = fixture([{ id: "submission-1", organizationId: "org-1", archivedAt: new Date() }]);
  await setSubmissionArchived(state.tx, { organizationId: "org-1", actorId: "user-1", submissionId: "submission-1", archived: false });
  assert.equal(state.records[0].archivedAt, null);
  assert.deepEqual(state.events.at(-1), { type: "audit", organizationId: "org-1", actorId: "user-1", action: "SUBMISSION_RESTORED", entityId: "submission-1" });
});

test("does not mutate or audit a submission from another organization", async () => {
  const state = fixture([{ id: "submission-1", organizationId: "org-other", archivedAt: null }]);
  await assert.rejects(setSubmissionArchived(state.tx, { organizationId: "org-1", actorId: "user-1", submissionId: "submission-1", archived: false }), { code: "SUBMISSION_NOT_FOUND" });
  assert.equal(state.records[0].archivedAt, null);
  assert.deepEqual(state.events, []);
});

test("permanent deletion removes the row and writes an audit event without answer data", async () => {
  const state = fixture([{ id: "submission-1", organizationId: "org-1", archivedAt: new Date(), answers: { private: "answer" } }]);
  await permanentlyDeleteSubmission(state.tx, { organizationId: "org-1", actorId: "user-1", submissionId: "submission-1" });
  assert.deepEqual(state.records, []);
  assert.deepEqual(state.events, [
    { type: "delete", id: "submission-1" },
    { type: "audit", organizationId: "org-1", actorId: "user-1", action: "SUBMISSION_PERMANENTLY_DELETED", entityId: "submission-1" },
  ]);
});
