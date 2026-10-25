import assert from "node:assert/strict";
import test from "node:test";
import { duplicateForm } from "../../../dist/modules/forms/form-duplication.js";

function fixture(source) {
  const events = [];
  const tx = {
    findSourceForm: async (input) => source?.organizationId === input.organizationId && source?.id === input.formId ? source : null,
    createDraft: async (input) => { events.push({ type: "create", input }); return { id: "copy-1", ...input }; },
    writeAudit: async (input) => events.push({ type: "audit", ...input }),
  };
  return { tx, events };
}

test("duplicates the current definition as a new draft without published or response data", async () => {
  const source = {
    id: "form-1", organizationId: "org-1", title: "Peer review", description: "Review notes",
    draftDefinition: { title: "Peer review", description: "Review notes", language: "fr", fields: [{ id: "e2a3832f-7532-4e17-99e2-40107d00f321", type: "shortText", label: "Notes", description: "", required: true }] },
  };
  const { tx, events } = fixture(source);
  const result = await duplicateForm(tx, { organizationId: "org-1", actorId: "owner-1", formId: "form-1", title: "Peer review (copy)" });
  assert.equal(result.id, "copy-1");
  assert.deepEqual(events[0].input, {
    organizationId: "org-1", title: "Peer review (copy)", description: "Review notes", status: "DRAFT", currentPublishedId: null,
    draftDefinition: { ...source.draftDefinition, title: "Peer review (copy)" },
  });
  assert.deepEqual(events[1], { type: "audit", organizationId: "org-1", actorId: "owner-1", action: "FORM_DUPLICATED", entityId: "copy-1", metadata: { sourceFormId: "form-1" } });
  assert.equal(source.title, "Peer review");
});

test("cannot duplicate a form from another workspace or a missing form", async () => {
  const { tx } = fixture({ id: "other", organizationId: "org-2", title: "Secret", description: "", draftDefinition: {} });
  await assert.rejects(duplicateForm(tx, { organizationId: "org-1", actorId: "owner-1", formId: "form-1", title: "Copy" }), { status: 404, code: "FORM_NOT_FOUND" });
});

test("rejects a form whose saved definition cannot be validated", async () => {
  const { tx } = fixture({ id: "form-1", organizationId: "org-1", title: "Broken", description: "", draftDefinition: { title: "Broken", fields: "invalid" } });
  await assert.rejects(duplicateForm(tx, { organizationId: "org-1", actorId: "owner-1", formId: "form-1", title: "Copy" }), { status: 409, code: "FORM_NOT_DUPLICABLE" });
});
