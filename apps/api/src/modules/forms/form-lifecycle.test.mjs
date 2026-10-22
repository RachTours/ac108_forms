import assert from "node:assert/strict";
import test from "node:test";
import { permanentlyDeleteForm, restoreForm } from "../../../dist/modules/forms/form-lifecycle.js";

function fixture(form = { id: "form-1", organizationId: "org-1", archivedAt: new Date(), currentPublishedId: "version-1" }, submissionCount = 0) {
  const events = [];
  const state = { form, submissionCount, deleted: false, restoredStatus: null, events };
  const tx = {
    findArchivedForm: async ({ formId, organizationId }) => state.form?.id === formId && state.form.organizationId === organizationId && state.form.archivedAt ? state.form : null,
    findForm: async ({ formId, organizationId }) => state.form?.id === formId && state.form.organizationId === organizationId ? state.form : null,
    countSubmissions: async ({ formId }) => state.form?.id === formId ? state.submissionCount : 0,
    restoreForm: async (formId, status) => { state.restoredStatus = status; state.form.archivedAt = null; state.form.status = status; events.push({ type: "restore", formId, status }); },
    deleteForm: async (formId) => { state.deleted = true; events.push({ type: "delete", formId }); },
    writeAudit: async (entry) => { events.push({ type: "audit", ...entry }); },
  };
  return { tx, state };
}

test("restores archived published forms as published and writes an audit event", async () => {
  const { tx, state } = fixture();
  await restoreForm(tx, { organizationId: "org-1", actorId: "owner-1", formId: "form-1" });
  assert.equal(state.restoredStatus, "PUBLISHED");
  assert.deepEqual(state.events.at(-1), { type: "audit", organizationId: "org-1", actorId: "owner-1", action: "FORM_RESTORED", entityId: "form-1" });
});

test("restores archived forms with no published version as drafts", async () => {
  const { tx, state } = fixture({ id: "form-1", organizationId: "org-1", archivedAt: new Date(), currentPublishedId: null });
  await restoreForm(tx, { organizationId: "org-1", actorId: "owner-1", formId: "form-1" });
  assert.equal(state.restoredStatus, "DRAFT");
});

test("refuses to permanently delete an archived form while submissions reference it", async () => {
  const { tx, state } = fixture(undefined, 1);
  await assert.rejects(permanentlyDeleteForm(tx, { organizationId: "org-1", actorId: "owner-1", formId: "form-1" }), { code: "FORM_HAS_SUBMISSIONS" });
  assert.equal(state.deleted, false);
  assert.deepEqual(state.events, []);
});

test("permanently deletes an empty archived form and audits without copying content", async () => {
  const { tx, state } = fixture();
  await permanentlyDeleteForm(tx, { organizationId: "org-1", actorId: "owner-1", formId: "form-1" });
  assert.equal(state.deleted, true);
  assert.deepEqual(state.events, [
    { type: "delete", formId: "form-1" },
    { type: "audit", organizationId: "org-1", actorId: "owner-1", action: "FORM_PERMANENTLY_DELETED", entityId: "form-1" },
  ]);
});

test("permanently deletes an empty active form when explicitly requested", async () => {
  const { tx, state } = fixture({ id: "form-1", organizationId: "org-1", archivedAt: null, currentPublishedId: null });
  await permanentlyDeleteForm(tx, { organizationId: "org-1", actorId: "owner-1", formId: "form-1" });
  assert.equal(state.deleted, true);
});
