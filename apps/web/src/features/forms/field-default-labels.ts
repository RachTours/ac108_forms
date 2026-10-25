import type { FormField } from "@reviewroom/contracts/forms";

export const defaultFieldLabels: Record<FormField["type"], string> = {
  heading: "Section heading",
  name: "Full name",
  shortText: "Short text",
  longText: "Long text",
  email: "Email",
  url: "Website / URL",
  phone: "Phone number",
  yesNo: "Yes / No",
  number: "Number",
  singleChoice: "Multiple choice",
  checkboxes: "Checkboxes",
  dropdown: "Dropdown",
  rating: "Rating scale",
  date: "Date",
  consent: "Consent",
  ranking: "Ranking",
  signature: "Signature",
};

export const defaultFieldTranslationKeys = {
  heading: "sectionHeading",
  name: "fullName",
  shortText: "shortText",
  longText: "longText",
  email: "email",
  url: "website",
  phone: "phone",
  yesNo: "yesNo",
  number: "number",
  singleChoice: "singleChoiceQuestion",
  checkboxes: "checkboxesQuestion",
  dropdown: "dropdown",
  rating: "rating",
  date: "date",
  consent: "consent",
  ranking: "ranking",
  signature: "signature",
} as const satisfies Record<FormField["type"], string>;

export const defaultFieldDescriptions = {
  name: "This name appears as the reviewed person in submissions.",
  heading: "Add context for the questions in this section.",
} as const;

export function isDefaultFieldLabel(field: FormField): boolean {
  return field.label === defaultFieldLabels[field.type];
}

export function getDefaultFieldDescription(field: FormField): string | null {
  if (field.type === "name" && field.description === defaultFieldDescriptions.name) return field.description;
  if (field.type === "heading" && field.description === defaultFieldDescriptions.heading) return field.description;
  return null;
}
