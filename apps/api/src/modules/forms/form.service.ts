import { formDefinitionWriteSchema, type FormDefinition } from "@reviewroom/contracts/forms";
import { prisma } from "../../db/client.js";
import { HttpError } from "../../http/errors.js";
import { permanentlyDeleteForm, restoreForm } from "./form-lifecycle.js";
import { loadFormSubmissionCounts } from "./form-submission-counts.js";
import { duplicateForm as duplicateFormRecord } from "./form-duplication.js";

export async function listForms(organizationId: string, state: "active" | "archived" = "active") {
  const rows = await prisma.form.findMany({
    where: { organizationId, archivedAt: state === "active" ? null : { not: null } },
    select: {
      id: true, title: true, description: true, status: true, updatedAt: true, currentPublishedId: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  const submissionCounts = await loadFormSubmissionCounts(prisma, organizationId, rows.map(({ id }) => id));
  return rows.map((row) => ({ ...row, submissionCount: submissionCounts.get(row.id) ?? 0 }));
}

export async function getForm(organizationId: string, formId: string) {
  const form = await prisma.form.findFirst({ where: { id: formId, organizationId, archivedAt: null } });
  if (!form) throw new HttpError(404, "FORM_NOT_FOUND", "Form not found.");
  return form;
}

export async function createForm(organizationId: string, actorId: string, input: { title: string; description: string }) {
  const definition: FormDefinition = { title: input.title, description: input.description, language: "en", fields: [] };
  return prisma.$transaction(async (transaction) => {
    const form = await transaction.form.create({ data: { organizationId, title: input.title, description: input.description, draftDefinition: definition } });
    await transaction.auditEvent.create({ data: { organizationId, actorId, action: "FORM_CREATED", entityType: "Form", entityId: form.id } });
    return form;
  });
}

export async function duplicateForm(organizationId: string, actorId: string, formId: string, title: string) {
  return prisma.$transaction(async (transaction) => duplicateFormRecord({
    findSourceForm: async ({ organizationId: scopedOrganizationId, formId: id }) => transaction.form.findFirst({ where: { id, organizationId: scopedOrganizationId, archivedAt: null }, select: { id: true, title: true, description: true, draftDefinition: true } }),
    createDraft: async ({ organizationId: scopedOrganizationId, title: copyTitle, description, status, currentPublishedId, draftDefinition }) => transaction.form.create({ data: { organizationId: scopedOrganizationId, title: copyTitle, description, status, currentPublishedId, draftDefinition: draftDefinition as object } }),
    writeAudit: async (entry) => { await transaction.auditEvent.create({ data: { ...entry, entityType: "Form" } }); },
  }, { organizationId, actorId, formId, title }));
}

export async function updateForm(organizationId: string, actorId: string, formId: string, input: FormDefinition) {
  const definition = formDefinitionWriteSchema.parse(input);
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.form.findFirst({ where: { id: formId, organizationId, archivedAt: null } });
    if (!existing) throw new HttpError(404, "FORM_NOT_FOUND", "Form not found.");
    const updated = await transaction.form.update({ where: { id: existing.id }, data: { title: definition.title, description: definition.description, draftDefinition: definition } });
    await transaction.auditEvent.create({ data: { organizationId, actorId, action: "FORM_DRAFT_UPDATED", entityType: "Form", entityId: updated.id } });
    return updated;
  });
}

export async function publishForm(organizationId: string, actorId: string, formId: string) {
  return prisma.$transaction(async (transaction) => {
    const form = await transaction.form.findFirst({ where: { id: formId, organizationId, archivedAt: null } });
    if (!form) throw new HttpError(404, "FORM_NOT_FOUND", "Form not found.");
    const parsed = formDefinitionWriteSchema.safeParse(form.draftDefinition);
    if (!parsed.success || parsed.data.fields.length === 0) throw new HttpError(422, "FORM_NOT_PUBLISHABLE", "Add at least one valid question before publishing.");
    const previous = await transaction.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (previous?.version ?? 0) + 1;
    const published = await transaction.formVersion.create({ data: { formId: form.id, version, definition: parsed.data, publishedAt: new Date() } });
    await transaction.form.update({ where: { id: form.id }, data: { currentPublishedId: published.id, status: "PUBLISHED" } });
    await transaction.auditEvent.create({ data: { organizationId, actorId, action: "FORM_PUBLISHED", entityType: "FormVersion", entityId: published.id, metadata: { formId: form.id, version } } });
    return published;
  });
}

export async function archiveForm(organizationId: string, actorId: string, formId: string) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.form.findFirst({ where: { id: formId, organizationId, archivedAt: null } });
    if (!existing) throw new HttpError(404, "FORM_NOT_FOUND", "Form not found.");
    const form = await transaction.form.update({ where: { id: existing.id }, data: { archivedAt: new Date(), status: "ARCHIVED" } });
    await transaction.reviewLink.updateMany({ where: { formId: form.id, revokedAt: null }, data: { revokedAt: new Date(), activeReviewerKey: null } });
    await transaction.auditEvent.create({ data: { organizationId, actorId, action: "FORM_ARCHIVED", entityType: "Form", entityId: form.id } });
    return form;
  });
}

export async function restoreArchivedForm(organizationId: string, actorId: string, formId: string) {
  return prisma.$transaction(async (transaction) => restoreForm({
    findArchivedForm: async ({ organizationId: scopedOrganizationId, formId: id }) => transaction.form.findFirst({ where: { id, organizationId: scopedOrganizationId, archivedAt: { not: null } }, select: { id: true, currentPublishedId: true } }),
    findForm: async ({ organizationId: scopedOrganizationId, formId: id }) => transaction.form.findFirst({ where: { id, organizationId: scopedOrganizationId }, select: { id: true, currentPublishedId: true } }),
    countSubmissions: async ({ formId: id }) => transaction.submission.count({ where: { formId: id } }),
    restoreForm: async (id, status) => { await transaction.form.update({ where: { id }, data: { archivedAt: null, status } }); },
    deleteForm: async (id) => { await transaction.form.delete({ where: { id } }); },
    writeAudit: async ({ organizationId: scopedOrganizationId, actorId: actingUserId, action, entityId }) => { await transaction.auditEvent.create({ data: { organizationId: scopedOrganizationId, actorId: actingUserId, action, entityType: "Form", entityId } }); },
  }, { organizationId, actorId, formId }));
}

export async function permanentlyDeleteArchivedForm(organizationId: string, actorId: string, formId: string) {
  try {
    return await prisma.$transaction(async (transaction) => permanentlyDeleteForm({
      findArchivedForm: async ({ organizationId: scopedOrganizationId, formId: id }) => transaction.form.findFirst({ where: { id, organizationId: scopedOrganizationId, archivedAt: { not: null } }, select: { id: true, currentPublishedId: true } }),
      findForm: async ({ organizationId: scopedOrganizationId, formId: id }) => transaction.form.findFirst({ where: { id, organizationId: scopedOrganizationId }, select: { id: true, currentPublishedId: true } }),
      countSubmissions: async ({ formId: id }) => transaction.submission.count({ where: { formId: id } }),
      restoreForm: async (id, status) => { await transaction.form.update({ where: { id }, data: { archivedAt: null, status } }); },
      deleteForm: async (id) => { await transaction.form.delete({ where: { id } }); },
      writeAudit: async ({ organizationId: scopedOrganizationId, actorId: actingUserId, action, entityId }) => { await transaction.auditEvent.create({ data: { organizationId: scopedOrganizationId, actorId: actingUserId, action, entityType: "Form", entityId } }); },
    }, { organizationId, actorId, formId }));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "P2003" || code === "P2014") throw new HttpError(409, "FORM_HAS_SUBMISSIONS", "Delete all submissions for this form before permanently removing it.");
    throw error;
  }
}
