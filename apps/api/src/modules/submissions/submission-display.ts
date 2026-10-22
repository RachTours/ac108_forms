import { formDefinitionSchema } from "@reviewroom/contracts/forms";

export function getReviewedPersonName(definitionValue: unknown, answersValue: unknown, fallback: string): string {
  const definition = formDefinitionSchema.safeParse(definitionValue);
  if (!definition.success) return fallback;
  const nameField = definition.data.fields.find((field) => field.type === "name");
  if (!nameField || answersValue === null || typeof answersValue !== "object" || Array.isArray(answersValue)) return fallback;
  const answer = (answersValue as Record<string, unknown>)[nameField.id];
  if (typeof answer !== "string") return fallback;
  const displayName = answer.trim().replace(/^Reviewed person\s*:\s*/i, "").trim();
  return displayName || fallback;
}
