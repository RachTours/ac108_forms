import assert from "node:assert/strict";
import test from "node:test";
import { themeUpdatePayload } from "./theme-settings.ts";

test("theme update payload excludes read-only server fields", () => {
  assert.deepEqual(themeUpdatePayload({
    accentColor: "#2457A6",
    fontPreset: "serif",
    surfacePreset: "warm",
    formStyle: "soft",
    updatedAt: "2026-10-22T12:00:00.000Z",
  }), { accentColor: "#2457A6", fontPreset: "serif", surfacePreset: "warm", formStyle: "soft" });
});
