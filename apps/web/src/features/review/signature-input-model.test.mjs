import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSignaturePoint } from "./signature-input-model.ts";

test("signature points normalize pointer coordinates to a responsive SVG viewport", () => {
  assert.deepEqual(normalizeSignaturePoint(110, 70, { left: 10, top: 20, width: 200, height: 100 }), { x: 0.5, y: 0.5 });
});

test("signature points clamp outside pointer coordinates to the canvas edges", () => {
  assert.deepEqual(normalizeSignaturePoint(-20, 150, { left: 0, top: 0, width: 100, height: 100 }), { x: 0, y: 1 });
});

test("signature points remain finite when a canvas has no measurable size", () => {
  assert.deepEqual(normalizeSignaturePoint(20, 30, { left: 0, top: 0, width: 0, height: 0 }), { x: 0, y: 0 });
});
