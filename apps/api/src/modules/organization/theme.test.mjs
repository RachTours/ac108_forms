import test from "node:test";
import assert from "node:assert/strict";
import { contrastRatioAgainstWhite, defaultWorkspaceTheme, themeAccentColors, themeCssVariables, themeSchema } from "../../../dist/modules/organization/theme.js";

test("theme choices accept only the built-in colors and font presets", () => {
  assert.deepEqual(themeSchema.parse(defaultWorkspaceTheme), defaultWorkspaceTheme);
  assert.throws(() => themeSchema.parse({ accentColor: "red; background:url(https://example.invalid)", fontPreset: "sans" }));
  assert.throws(() => themeSchema.parse({ accentColor: "#167354", fontPreset: "https://example.invalid/font.css" }));
  assert.throws(() => themeSchema.parse({ ...defaultWorkspaceTheme, arbitraryCss: "color:red" }));
});

test("theme font presets map to system font stacks, never remote fonts", () => {
  assert.match(themeCssVariables({ ...defaultWorkspaceTheme, fontPreset: "serif" }).fontFamily, /Georgia/);
  assert.match(themeCssVariables({ ...defaultWorkspaceTheme, fontPreset: "system" }).fontFamily, /system-ui/);
  assert.doesNotMatch(themeCssVariables({ ...defaultWorkspaceTheme, fontPreset: "sans" }).fontFamily, /https?:/);
});

test("every selectable accent meets 4.5:1 contrast for white button labels", () => {
  for (const accent of themeAccentColors) assert.ok(contrastRatioAgainstWhite(accent) >= 4.5, `${accent} must meet WCAG AA normal-text contrast`);
});

test("theme appearance presets are allowlisted and map to workspace and form surfaces", () => {
  const theme = { ...defaultWorkspaceTheme, surfacePreset: "warm", formStyle: "soft" };
  assert.deepEqual(themeSchema.parse(theme), theme);
  assert.throws(() => themeSchema.parse({ ...theme, surfacePreset: "url(javascript:alert(1))" }));
  assert.throws(() => themeSchema.parse({ ...theme, formStyle: "custom-css" }));
  const variables = themeCssVariables(theme);
  assert.equal(variables.canvasColor, "#f7f4ef");
  assert.equal(variables.formSurface, "#fbfaf7");
  assert.equal(variables.formBorder, "#e9e1d6");
});
