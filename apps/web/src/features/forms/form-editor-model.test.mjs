import assert from "node:assert/strict";
import test from "node:test";
import { formDefinitionWriteSchema } from "@reviewroom/contracts/forms";
import { fieldPalette, makeField } from "./form-editor-model.ts";

test("editor offers a required Full name field with the right input limit", () => {
  const field = makeField("name", () => "00000000-0000-4000-8000-000000000001");
  assert.equal(fieldPalette.find((item) => item.type === "name")?.label, "Full name");
  assert.deepEqual(field, { id: "00000000-0000-4000-8000-000000000001", type: "name", label: "Full name", description: "This name appears as the reviewed person in submissions.", required: true, maxLength: 160 });
  assert.equal(formDefinitionWriteSchema.safeParse({ title: "Review", description: "", fields: [field] }).success, true);
});

test("editor exposes the signature field in the existing field catalog", () => {
  assert.equal(fieldPalette.find((item) => item.type === "signature")?.label, "Signature");
  const signature = makeField("signature", () => "00000000-0000-4000-8000-000000000002");
  assert.equal(signature.type, "signature");
});

test("editor offers a non-required section heading for organizing long forms", () => {
  const heading = makeField("heading", () => "00000000-0000-4000-8000-000000000003");

  assert.equal(fieldPalette.find((item) => item.type === "heading")?.label, "Section heading");
  assert.equal(heading.type, "heading");
  assert.equal(heading.label, "Section heading");
  assert.equal(heading.required, false);
  assert.equal(formDefinitionWriteSchema.safeParse({ title: "Review", description: "", fields: [heading] }).success, true);
});
