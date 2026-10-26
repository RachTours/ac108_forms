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

// A matching key set alone cannot catch missing keys referenced by components.
import ts from "typescript";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(directory, entry.name)] : []));
  return nested.flat();
}
test("literal interface message lookups exist in every supported language", async () => {
  const root = new URL("../../", import.meta.url);
  const files = (await Promise.all(["app", "src"].map((part) => sourceFiles(fileURLToPath(new URL(part, root)))))).flat();
  const failures = [];
  const program = ts.createProgram(files, { noResolve: true, jsx: ts.JsxEmit.Preserve });
  const checker = program.getTypeChecker();
  for (const file of files) {
    const source = program.getSourceFile(file);
    function calls(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const declaration = checker.getSymbolAtLocation(node.expression)?.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
          const call = ts.isAwaitExpression(declaration.initializer) ? declaration.initializer.expression : declaration.initializer;
          if (ts.isCallExpression(call) && ts.isIdentifier(call.expression) && ["useTranslations", "getTranslations"].includes(call.expression.text) && call.arguments[0] && ts.isStringLiteral(call.arguments[0])) {
            const path = call.arguments[0].text + "." + node.arguments[0].text;
            for (const [locale, catalog] of Object.entries(messages)) {
              const value = path.split(".").reduce((current, key) => current?.[key], catalog);
              if (typeof value !== "string") failures.push(locale + ": " + path + " in " + file);
            }
          }
        }
      }
      ts.forEachChild(node, calls);
    }
    if (source) calls(source);
  }
  assert.deepEqual(failures, []);
});
