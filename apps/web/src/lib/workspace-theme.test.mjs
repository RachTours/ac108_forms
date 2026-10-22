import assert from "node:assert/strict";
import test from "node:test";
import { defaultWorkspaceTheme, safeWorkspaceTheme, workspaceThemeCssVariables } from "./workspace-theme.ts";

test("safe theme mapping applies the chosen canvas and form surface across workspace pages", () => {
  const theme = safeWorkspaceTheme({ accentColor: "#2457A6", fontPreset: "serif", surfacePreset: "warm", formStyle: "soft" });
  const variables = workspaceThemeCssVariables(theme);
  assert.equal(variables["--green"], "#2457A6");
  assert.equal(variables["--canvas"], "#f7f4ef");
  assert.equal(variables["--form-surface"], "#fbfaf7");
  assert.equal(variables["--form-border"], "#e9e1d6");
  assert.match(variables["--display"], /Georgia/);
});

test("legacy or unsafe theme values fall back to accessible built-in presets", () => {
  assert.deepEqual(safeWorkspaceTheme({ accentColor: "url(javascript:alert(1))", fontPreset: "https://evil.invalid", surfacePreset: "transparent", formStyle: "custom" }), defaultWorkspaceTheme);
  assert.equal(workspaceThemeCssVariables(defaultWorkspaceTheme)["--canvas"], "#f4f7f4");
});
