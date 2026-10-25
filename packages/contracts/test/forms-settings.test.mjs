import assert from "node:assert/strict";
import test from "node:test";
import { formDefinitionSchema } from "../dist/forms.js";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const field = (id, type, properties = {}) => ({ id: uuid(id), type, label: `Question ${id}`, description: "", required: false, ...properties });

test("text, email, URL, number, and dropdown fields accept configured placeholders and constraints", () => {
  const result = formDefinitionSchema.safeParse({
    title: "Review", description: "", fields: [
      field(1, "shortText", { placeholder: "Add a short note", minLength: 2, maxLength: 80 }),
      field(2, "email", { placeholder: "name@example.com", minLength: 5, maxLength: 254 }),
      field(3, "url", { placeholder: "https://example.com", maxLength: 1500 }),
      field(4, "number", { placeholder: "Enter a score", min: 0, max: 10, step: 0.5 }),
      field(5, "dropdown", { placeholder: "Pick a department", options: [{ id: uuid(50), label: "One" }, { id: uuid(51), label: "Two" }] }),
    ],
  });

  assert.equal(result.success, true);
});

test("form settings reject reversed limits and invalid number steps", () => {
  const base = { title: "Review", description: "", fields: [field(1, "number", { min: 10, max: 1, step: 0 })] };
  assert.equal(formDefinitionSchema.safeParse(base).success, false);
  assert.equal(formDefinitionSchema.safeParse({ ...base, fields: [field(1, "number", { step: -1 })] }).success, false);
  assert.equal(formDefinitionSchema.safeParse({ ...base, fields: [field(1, "email", { minLength: 10, maxLength: 4 })] }).success, false);
});

test("legacy definitions default to English and supported languages round-trip", () => {
  const legacy = formDefinitionSchema.parse({ title: "Review", description: "", fields: [] });
  assert.equal(legacy.language, "en");

  for (const language of ["en", "fr", "ar"]) {
    const parsed = formDefinitionSchema.parse({ ...legacy, language });
    assert.equal(parsed.language, language);
    assert.equal(formDefinitionSchema.parse(JSON.parse(JSON.stringify(parsed))).language, language);
  }
  assert.equal(formDefinitionSchema.safeParse({ ...legacy, language: "es" }).success, false);
});
