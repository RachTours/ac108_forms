import type { FormField } from "@reviewroom/contracts/forms";

export const fieldPalette: { type: FormField["type"]; label: string }[] = [
  { type: "heading", label: "Section heading" },
  { type: "name", label: "Full name" }, { type: "shortText", label: "Short text" }, { type: "longText", label: "Long text" }, { type: "email", label: "Email" }, { type: "url", label: "Website / URL" }, { type: "phone", label: "Phone number" }, { type: "yesNo", label: "Yes / No" }, { type: "number", label: "Number" },
  { type: "singleChoice", label: "Multiple choice" }, { type: "checkboxes", label: "Checkboxes" }, { type: "dropdown", label: "Dropdown" }, { type: "rating", label: "Rating scale" },
  { type: "date", label: "Date" }, { type: "consent", label: "Consent" }, { type: "ranking", label: "Ranking" }, { type: "signature", label: "Signature" },
];

export function makeField(type: FormField["type"], createId: () => string = () => crypto.randomUUID()): FormField {
  const base = { id: createId(), label: fieldPalette.find((item) => item.type === type)?.label ?? "New question", description: type === "name" ? "This name appears as the reviewed person in submissions." : "", required: type === "name" };
  switch (type) {
    case "heading": return { ...base, type, description: "Add context for the questions in this section." };
    case "singleChoice": case "checkboxes": case "dropdown": case "ranking": return { ...base, type, options: [{ id: createId(), label: "Option one" }, { id: createId(), label: "Option two" }], ...(type === "ranking" ? { direction: "Arrange from most preferred to least preferred" } : {}) } as FormField;
    case "name": return { ...base, type, maxLength: 160 };
    case "shortText": return { ...base, type, maxLength: 250 };
    case "longText": return { ...base, type, maxLength: 2000 };
    case "number": return { ...base, type };
    case "rating": return { ...base, type, min: 1, max: 5, step: 1 };
    case "consent": return { ...base, type, consentText: "I agree" };
    default: return { ...base, type };
  }
}
