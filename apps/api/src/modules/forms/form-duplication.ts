import { formDefinitionWriteSchema } from "@reviewroom/contracts/forms";
import { HttpError } from "../../http/errors.js";

export type FormDuplicationTransaction = {
  findSourceForm(input: { organizationId: string; formId: string }): Promise<{ id: string; title: string; description: string; draftDefinition: unknown } | null>;
  createDraft(input: { organizationId: string; title: string; description: string; status: "DRAFT"; currentPublishedId: null; draftDefinition: unknown }): Promise<unknown>;
  writeAudit(input: { organizationId: string; actorId: string; action: string; entityId: string; metadata: { sourceFormId: string } }): Promise<void>;
};

export async function duplicateForm(
  transaction: FormDuplicationTransaction,
  input: { organizationId: string; actorId: string; formId: string; title: string },
) {
  const source = await transaction.findSourceForm({ organizationId: input.organizationId, formId: input.formId });
  if (!source) throw new HttpError(404, "FORM_NOT_FOUND", "Form not found.");

  const definition = formDefinitionWriteSchema.safeParse(source.draftDefinition);
  if (!definition.success) throw new HttpError(409, "FORM_NOT_DUPLICABLE", "The saved form definition cannot be duplicated.");

  const copy = await transaction.createDraft({
    organizationId: input.organizationId,
    title: input.title,
    description: source.description,
    status: "DRAFT",
    currentPublishedId: null,
    draftDefinition: { ...definition.data, title: input.title },
  });
  const copyId = (copy as { id: string }).id;
  await transaction.writeAudit({ organizationId: input.organizationId, actorId: input.actorId, action: "FORM_DUPLICATED", entityId: copyId, metadata: { sourceFormId: source.id } });
  return copy;
}
