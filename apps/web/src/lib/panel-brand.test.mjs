import assert from "node:assert/strict";
import test from "node:test";
import { panelNameForAudience } from "./panel-brand.ts";

test("panel branding is audience-specific and defaults safely to admin", () => {
  assert.equal(panelNameForAudience("admin"), "Admin Panel");
  assert.equal(panelNameForAudience("reviewer"), "Reviewer Panel");
  assert.equal(panelNameForAudience(null), "Admin Panel");
  assert.equal(panelNameForAudience("unknown"), "Admin Panel");
});
