import { formDefinitionSchema } from "@reviewroom/contracts/forms";
/** Project new metadata away for the unchanged, strict v1 form contract. */
export function toLegacyDefinition(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { language: _language, ...definition } = value as Record<string, unknown>;
  return { ...definition, ...(Array.isArray(definition.fields) ? { fields: definition.fields.map((field: Record<string, unknown>) => {
    const { placeholder: _placeholder, ...legacy } = field;
    if (field.type === "number") delete legacy.step;
    if (field.type === "email" || field.type === "url") { delete legacy.minLength; delete legacy.maxLength; }
    return legacy;
  }) } : {}) };
}
export function toLegacyFormRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return { ...record, ...(record.draftDefinition === undefined ? {} : { draftDefinition: toLegacyDefinition(record.draftDefinition) }), ...(record.definition === undefined ? {} : { definition: toLegacyDefinition(record.definition) }) };
}

/** Old editors cannot clear settings that their version does not understand. */
export function preserveLegacyDraftMetadata(incoming: unknown, stored: unknown) {
  const input = formDefinitionSchema.parse(incoming), current = formDefinitionSchema.safeParse(stored);
  if (!current.success) return input;
  const oldById = new Map(current.data.fields.map((field) => [field.id, field]));
  const fields = input.fields.map((field) => {
    const previous = oldById.get(field.id);
    if (!previous || previous.type !== field.type) return field;
    const keys = ["placeholder", ...(field.type === "number" ? ["step"] : []), ...(["email", "url"].includes(field.type) ? ["minLength", "maxLength"] : [])];
    const metadata = Object.fromEntries(Object.entries(previous).filter(([key]) => keys.includes(key)));
    return { ...field, ...metadata };
  });
  const explicitLanguage = incoming && typeof incoming === "object" && Object.hasOwn(incoming, "language");
  return formDefinitionSchema.parse({ ...input, fields, language: explicitLanguage ? input.language : current.data.language });
}
