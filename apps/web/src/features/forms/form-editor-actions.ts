import type { FormField } from "@reviewroom/contracts/forms";

export type PersistFormResult =
  | { kind: "saved" }
  | { kind: "published" }
  | { kind: "failed"; stage: "save" | "publish"; draftSaved: boolean; message: string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function persistForm(
  saveDraft: () => Promise<unknown>,
  publishDraft: () => Promise<unknown>,
  shouldPublish = false,
): Promise<PersistFormResult> {
  try {
    await saveDraft();
  } catch (error) {
    return { kind: "failed", stage: "save", draftSaved: false, message: errorMessage(error, "Could not save the draft.") };
  }

  if (!shouldPublish) return { kind: "saved" };

  try {
    await publishDraft();
    return { kind: "published" };
  } catch (error) {
    return { kind: "failed", stage: "publish", draftSaved: true, message: errorMessage(error, "Could not publish the form.") };
  }
}

export function duplicateField(field: FormField, createId: () => string = () => crypto.randomUUID()): FormField {
  const copy = { ...field, id: createId() };
  if ("options" in copy) return { ...copy, options: copy.options.map((option) => ({ ...option, id: createId() })) };
  return copy;
}

export function moveField<T extends { id: string }>(fields: readonly T[], fieldId: string, direction: -1 | 1): T[] {
  const reordered = [...fields];
  const index = reordered.findIndex((field) => field.id === fieldId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= reordered.length) return reordered;
  [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
  return reordered;
}

export function moveFieldTo<T extends { id: string }>(fields: readonly T[], fieldId: string, targetId: string): T[] {
  const sourceIndex = fields.findIndex((field) => field.id === fieldId);
  const targetIndex = fields.findIndex((field) => field.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return [...fields];
  const reordered = [...fields];
  const [moved] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, moved!);
  return reordered;
}
