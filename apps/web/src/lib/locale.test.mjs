import assert from "node:assert/strict";
import test from "node:test";
import { directionForLocale, formatNumber, resolveLocale } from "./locale.ts";

test("stored language choice takes priority over browser preferences", () => {
  assert.equal(resolveLocale("fr", "ar-MA,ar;q=0.9,en;q=0.8"), "fr");
});

test("browser language variants resolve to a supported language", () => {
  assert.equal(resolveLocale(undefined, "fr-CA,fr;q=0.9,en;q=0.8"), "fr");
  assert.equal(resolveLocale(undefined, "ar-MA,ar;q=0.9,en;q=0.8"), "ar");
});

test("quality values select the preferred supported language", () => {
  assert.equal(resolveLocale(undefined, "fr;q=0.5,ar;q=0.9,en;q=0.7"), "ar");
});

test("unsupported or malformed preferences fall back to English", () => {
  assert.equal(resolveLocale("es", "es-MX,es;q=0.9"), "en");
  assert.equal(resolveLocale("AR", "invalid;q=no,es"), "en");
});

test("only Arabic uses right-to-left direction", () => {
  assert.equal(directionForLocale("ar"), "rtl");
  assert.equal(directionForLocale("en"), "ltr");
  assert.equal(directionForLocale("fr"), "ltr");
});

test("number grouping is localized and Arabic uses Western digits", () => {
  assert.equal(formatNumber(12345, "en"), "12,345");
  assert.equal(formatNumber(12345, "fr"), "12 345");
  assert.equal(formatNumber(12345, "ar"), "12,345");
  assert.equal(formatNumber(8.333, "ar"), "8.33");
});
