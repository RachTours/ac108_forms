import assert from "node:assert/strict";
import test from "node:test";
import { formDefinitionSchema, formDefinitionWriteSchema } from "@reviewroom/contracts/forms";
import { validateAnswers } from "../../../dist/modules/submissions/answer-validator.js";

const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const field = (id, type, extra = {}, required = false) => ({ id: uuid(id), type, label: `Question ${id}`, description: "", required, ...extra });
const option = (id, label) => ({ id: uuid(id), label });

test("accepts a valid response for every supported field type", () => {
  const fields = [
    field(15, "name", { minLength: 2, maxLength: 160 }, true),
    field(1, "shortText", { minLength: 1, maxLength: 30 }),
    field(2, "longText", { minLength: 1, maxLength: 100 }),
    field(3, "email"),
    field(4, "number", { min: 0, max: 10 }),
    field(5, "singleChoice", { options: [option(50, "A"), option(51, "B")] }),
    field(6, "checkboxes", { options: [option(60, "A"), option(61, "B")], minSelections: 1, maxSelections: 2 }),
    field(7, "dropdown", { options: [option(70, "A"), option(71, "B")] }),
    field(8, "rating", { min: 1, max: 5, step: 2 }),
    field(9, "date"),
    field(10, "consent", { consentText: "I agree" }),
    field(11, "ranking", { options: [option(110, "A"), option(111, "B")], direction: "Best to least" }),
    field(12, "url"),
    field(13, "phone"),
    field(14, "yesNo"),
    field(16, "signature", {}, true),
  ];
  const definition = { title: "Review", description: "", fields };
  const answers = {
    [uuid(15)]: "Moha Example",
    [uuid(1)]: "clear",
    [uuid(2)]: "A detailed response",
    [uuid(3)]: "STUDENT@example.com",
    [uuid(4)]: 4,
    [uuid(5)]: uuid(50),
    [uuid(6)]: [uuid(60)],
    [uuid(7)]: uuid(70),
    [uuid(8)]: 3,
    [uuid(9)]: "2026-10-21",
    [uuid(10)]: true,
    [uuid(11)]: [uuid(111), uuid(110)],
    [uuid(12)]: "https://example.edu/review",
    [uuid(13)]: "+1 (555) 123-4567",
    [uuid(14)]: false,
    [uuid(16)]: { mode: "typed", text: "Moha Example" },
  };

  const parsed = formDefinitionSchema.safeParse(definition);
  assert.equal(parsed.success, true);
  assert.deepEqual(validateAnswers(definition, answers), { ...answers, [uuid(3)]: "student@example.com", [uuid(13)]: "+15551234567" });
});

test("name answers require a string and enforce name length limits", () => {
  const definition = { title: "Review", description: "", fields: [field(1, "name", { minLength: 2, maxLength: 20 }, true)] };
  assert.deepEqual(validateAnswers(definition, { [uuid(1)]: "  Ada Lovelace  " }), { [uuid(1)]: "Ada Lovelace" });
  assert.throws(() => validateAnswers(definition, { [uuid(1)]: 42 }), (error) => error.code === "INVALID_ANSWER");
  assert.throws(() => validateAnswers(definition, { [uuid(1)]: "x" }), (error) => error.code === "INVALID_ANSWER");
  assert.throws(() => validateAnswers(definition, { [uuid(1)]: "A name much longer than twenty" }), (error) => error.code === "INVALID_ANSWER");
});

test("optional blank values are omitted instead of blocking submission", () => {
  const fields = [field(1, "email"), field(2, "number"), field(3, "date"), field(4, "singleChoice", { options: [option(40, "A"), option(41, "B")] })];
  const definition = { title: "Review", description: "", fields };
  const answers = { [uuid(1)]: "  ", [uuid(2)]: "", [uuid(3)]: "", [uuid(4)]: "" };

  assert.deepEqual(validateAnswers(definition, answers), {});
});

test("required whitespace-only text is rejected as a missing required answer", () => {
  const definition = { title: "Review", description: "", fields: [field(1, "shortText", {}, true)] };

  assert.throws(() => validateAnswers(definition, { [uuid(1)]: "   " }), (error) => error.code === "REQUIRED_ANSWER_MISSING");
});

test("checkbox minimum cannot exceed its available choices", () => {
  const definition = {
    title: "Review",
    description: "",
    fields: [field(1, "checkboxes", { options: [option(40, "A"), option(41, "B")], minSelections: 3 })],
  };

  assert.equal(formDefinitionWriteSchema.safeParse(definition).success, false);
  assert.equal(formDefinitionSchema.safeParse(definition).success, true);
});

test("rating fields reject a zero step before publishing", () => {
  const result = formDefinitionSchema.safeParse({
    title: "Review",
    description: "",
    fields: [field(1, "rating", { min: 1, max: 5, step: 0 })],
  });

  assert.equal(result.success, false);
});

test("URL fields reject unsafe schemes and phone fields reject malformed values", () => {
  const fields = [field(1, "url"), field(2, "phone")];
  const definition = { title: "Review", description: "", fields };

  assert.throws(() => validateAnswers(definition, { [uuid(1)]: "javascript:alert(1)", [uuid(2)]: "+1 (555) 123-4567" }), (error) => error.code === "INVALID_ANSWER");
  assert.throws(() => validateAnswers(definition, { [uuid(1)]: "https://example.edu", [uuid(2)]: "call me" }), (error) => error.code === "INVALID_ANSWER");
});

test("yes/no false is a valid explicit answer, not a missing value", () => {
  const definition = { title: "Review", description: "", fields: [field(1, "yesNo", {}, true)] };

  assert.deepEqual(validateAnswers(definition, { [uuid(1)]: false }), { [uuid(1)]: false });
});

test("choice and ranking answers reject IDs outside their field options", () => {
  const fields = [
    field(1, "singleChoice", { options: [option(10, "A"), option(11, "B")] }),
    field(2, "ranking", { options: [option(20, "A"), option(21, "B")], direction: "Best to least" }),
  ];
  const definition = { title: "Review", description: "", fields };

  assert.throws(() => validateAnswers(definition, { [uuid(1)]: uuid(99) }), (error) => error.code === "INVALID_ANSWER");
  assert.throws(() => validateAnswers(definition, { [uuid(2)]: [uuid(20), uuid(20)] }), (error) => error.code === "INVALID_ANSWER");
});

test("signature answers accept bounded typed names and normalized strokes only", () => {
  const definition = { title: "Review", description: "", fields: [field(1, "signature", {}, true)] };
  assert.deepEqual(validateAnswers(definition, { [uuid(1)]: { mode: "typed", text: "Ada" } }), { [uuid(1)]: { mode: "typed", text: "Ada" } });
  assert.deepEqual(validateAnswers(definition, { [uuid(1)]: { mode: "drawn", strokes: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] } }), { [uuid(1)]: { mode: "drawn", strokes: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] } });
  assert.throws(() => validateAnswers(definition, { [uuid(1)]: { mode: "drawn", strokes: [{ points: [{ x: 2, y: 0 }, { x: 1, y: 1 }] }] } }), (error) => error.code === "INVALID_ANSWER");
  assert.throws(() => validateAnswers(definition, { [uuid(1)]: { mode: "typed", text: " " } }), (error) => error.code === "REQUIRED_ANSWER_MISSING");
});
