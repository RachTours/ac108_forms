import assert from "node:assert/strict";
import test from "node:test";
import { getReviewedPersonName } from "../../../dist/modules/submissions/submission-display.js";

const id = "00000000-0000-4000-8000-000000000001";

test("uses the submitted full name when a form has a name field", () => {
  const definition = { title: "Review", description: "", fields: [{ id, type: "name", label: "Full name", description: "", required: true }] };
  assert.equal(getReviewedPersonName(definition, { [id]: "  Ada Lovelace  " }, "Target fallback"), "Ada Lovelace");
});

test("uses the target name for historical submissions or forms without a name field", () => {
  assert.equal(getReviewedPersonName({ title: "Old", description: "", fields: [] }, {}, "Target fallback"), "Target fallback");
  assert.equal(getReviewedPersonName(null, { [id]: "Name" }, "Target fallback"), "Target fallback");
});

test("ignores blank name answers and uses the target name", () => {
  const definition = { title: "Review", description: "", fields: [{ id, type: "name", label: "Full name", description: "", required: false }] };
  assert.equal(getReviewedPersonName(definition, { [id]: "  " }, "Target fallback"), "Target fallback");
});

test("removes the legacy Reviewed person prefix from saved name answers", () => {
  const definition = { title: "Review", description: "", fields: [{ id, type: "name", label: "Full name", description: "", required: true }] };
  assert.equal(getReviewedPersonName(definition, { [id]: "Reviewed person: ahmed" }, "Target fallback"), "ahmed");
});
