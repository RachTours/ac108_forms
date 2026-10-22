import type { FormField } from "@reviewroom/contracts/forms";

export function buildInitialAnswers(fields: FormField[]): Record<string, string[]> {
  return Object.fromEntries(fields
    .filter((field): field is Extract<FormField, { type: "ranking" }> => field.type === "ranking")
    .map((field) => [field.id, field.options.map((option) => option.id)]));
}
