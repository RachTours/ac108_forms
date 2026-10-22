import assert from "node:assert/strict";
import test from "node:test";
import { duplicateField, moveField, moveFieldTo, persistForm } from "./form-editor-actions.ts";

test("publish saves the draft before publishing", async () => {
  const calls = [];
  const result = await persistForm(
    async () => calls.push("save"),
    async () => calls.push("publish"),
    true,
  );

  assert.deepEqual(calls, ["save", "publish"]);
  assert.deepEqual(result, { kind: "published" });
});

test("publish failure reports that the draft was already saved", async () => {
  const result = await persistForm(
    async () => {},
    async () => { throw new Error("Publish endpoint unavailable"); },
    true,
  );

  assert.deepEqual(result, {
    kind: "failed",
    stage: "publish",
    draftSaved: true,
    message: "Publish endpoint unavailable",
  });
});

test("save failure prevents the publish request", async () => {
  let publishCalled = false;
  const result = await persistForm(
    async () => { throw new Error("Draft could not be saved"); },
    async () => { publishCalled = true; },
    true,
  );

  assert.equal(publishCalled, false);
  assert.deepEqual(result, {
    kind: "failed",
    stage: "save",
    draftSaved: false,
    message: "Draft could not be saved",
  });
});

test("duplicating a choice field creates fresh field and option IDs", () => {
  const field = {
    id: "original",
    type: "singleChoice",
    label: "Preferred option",
    description: "Choose one",
    required: true,
    options: [{ id: "option-a", label: "Alpha" }, { id: "option-b", label: "Beta" }],
  };
  let nextId = 0;
  const copy = duplicateField(field, () => `copy-${++nextId}`);

  assert.deepEqual(copy, {
    ...field,
    id: "copy-1",
    options: [{ id: "copy-2", label: "Alpha" }, { id: "copy-3", label: "Beta" }],
  });
  assert.notEqual(copy.id, field.id);
  assert.ok(copy.options.every((option) => !field.options.some((original) => original.id === option.id)));
});

test("moving a question reorders fields without changing their IDs", () => {
  const fields = [{ id: "first" }, { id: "selected" }, { id: "last" }];
  const moved = moveField(fields, "selected", 1);

  assert.deepEqual(moved.map((field) => field.id), ["first", "last", "selected"]);
  assert.deepEqual(fields.map((field) => field.id), ["first", "selected", "last"]);
});

test("dropping a question on another question places it at that position", () => {
  const fields = [{ id: "first" }, { id: "dragged" }, { id: "target" }];

  assert.deepEqual(moveFieldTo(fields, "dragged", "target").map((field) => field.id), ["first", "target", "dragged"]);
  assert.deepEqual(fields.map((field) => field.id), ["first", "dragged", "target"]);
});
