import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const messages = Object.fromEntries(await Promise.all(["en", "fr", "ar"].map(async (locale) => [
  locale,
  JSON.parse(await readFile(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8")),
])));

function paths(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" ? paths(child, path) : [path];
  }).sort();
}

test("English, French, and Arabic dictionaries provide identical message keys", () => {
  const expected = paths(messages.en);
  assert.deepEqual(paths(messages.fr), expected);
  assert.deepEqual(paths(messages.ar), expected);
});
