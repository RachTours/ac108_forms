import type { FormField } from "@reviewroom/contracts/forms";

export const fieldPalette: { type: FormField["type"]; label: string; questionLabel?: string }[] = [
  { type: "heading", label: "Section heading" },
  { type: "name", label: "Full name" }, { type: "shortText", label: "Short text" }, { type: "longText", label: "Long text" }, { type: "email", label: "Email" }, { type: "url", label: "Website / URL" }, { type: "phone", label: "Phone number" }, { type: "yesNo", label: "Yes / No" }, { type: "number", label: "Number" },
  { type: "singleChoice", label: "Multiple choice — choose one", questionLabel: "Multiple choice" }, { type: "checkboxes", label: "Checkboxes — choose all that apply", questionLabel: "Checkboxes" }, { type: "dropdown", label: "Dropdown" }, { type: "rating", label: "Rating scale" },
  { type: "date", label: "Date" }, { type: "consent", label: "Consent" }, { type: "ranking", label: "Ranking" }, { type: "signature", label: "Signature" },
];

export function changeChoiceMode(field: Extract<FormField, { type: "singleChoice" | "checkboxes" }>, mode: "single" | "multiple"): FormField {
  if (mode === "multiple" && field.type === "singleChoice") return { ...field, type: "checkboxes" };
  if (mode === "single" && field.type === "checkboxes") {
    return { id: field.id, label: field.label, description: field.description, required: field.required, options: field.options, type: "singleChoice" };
  }
  return field;
}

export function makeField(type: FormField["type"], createId: () => string = () => crypto.randomUUID()): FormField {
  const paletteItem = fieldPalette.find((item) => item.type === type);
  const base = { id: createId(), label: paletteItem?.questionLabel ?? paletteItem?.label ?? "New question", description: type === "name" ? "This name appears as the reviewed person in submissions." : "", required: type === "name" };
  switch (type) {
    case "heading": return { ...base, type, description: "Add context for the questions in this section." };
    case "singleChoice": case "checkboxes": case "ranking": return { ...base, type, options: [{ id: createId(), label: "Option one" }, { id: createId(), label: "Option two" }], ...(type === "ranking" ? { direction: "Arrange from most preferred to least preferred" } : {}) } as FormField;
    case "dropdown": return { ...base, type, placeholder: "Choose an option", options: [{ id: createId(), label: "Option one" }, { id: createId(), label: "Option two" }] };
    case "name": return { ...base, type, maxLength: 160 };
    case "shortText": return { ...base, type, maxLength: 250 };
    case "longText": return { ...base, type, maxLength: 2000 };
    case "number": return { ...base, type };
    case "rating": return { ...base, type, min: 1, max: 5, step: 1 };
    case "consent": return { ...base, type, consentText: "I agree" };
    default: return { ...base, type };
  }
}
