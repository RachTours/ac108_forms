import { HttpError } from "../../http/errors.js";

export type FormLifecycleTransaction = {
  findArchivedForm(input: { organizationId: string; formId: string }): Promise<{ id: string; currentPublishedId: string | null } | null>;
  findForm(input: { organizationId: string; formId: string }): Promise<{ id: string; currentPublishedId: string | null } | null>;
  countSubmissions(input: { formId: string }): Promise<number>;
  restoreForm(formId: string, status: "DRAFT" | "PUBLISHED"): Promise<void>;
  deleteForm(formId: string): Promise<void>;
  writeAudit(input: { organizationId: string; actorId: string; action: string; entityId: string }): Promise<void>;
};

export async function restoreForm(
  transaction: FormLifecycleTransaction,
  input: { organizationId: string; actorId: string; formId: string },
): Promise<void> {
  const form = await transaction.findArchivedForm(input);
  if (!form) throw new HttpError(404, "FORM_NOT_FOUND", "Archived form not found.");
  const status = form.currentPublishedId ? "PUBLISHED" : "DRAFT";
  await transaction.restoreForm(form.id, status);
  await transaction.writeAudit({ organizationId: input.organizationId, actorId: input.actorId, action: "FORM_RESTORED", entityId: form.id });
}

export async function permanentlyDeleteForm(
  transaction: FormLifecycleTransaction,
  input: { organizationId: string; actorId: string; formId: string },
): Promise<void> {
  const form = await transaction.findForm(input);
  if (!form) throw new HttpError(404, "FORM_NOT_FOUND", "Form not found.");
  if (await transaction.countSubmissions({ formId: form.id })) {
    throw new HttpError(409, "FORM_HAS_SUBMISSIONS", "Permanently delete its submissions before deleting this form.");
  }
  await transaction.deleteForm(form.id);
  await transaction.writeAudit({ organizationId: input.organizationId, actorId: input.actorId, action: "FORM_PERMANENTLY_DELETED", entityId: form.id });
}
