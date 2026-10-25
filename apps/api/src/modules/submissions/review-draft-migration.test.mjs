import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../../../prisma/migrations/202610240002_review_drafts/migration.sql", import.meta.url), "utf8");
const schema = await readFile(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");

test("review draft migration uses MySQL-safe index names", () => {
  const names = [...migration.matchAll(/(?:UNIQUE )?INDEX `([^`]+)`/g)].map(([, name]) => name);
  assert.ok(names.length > 0, "expected at least one index");
  assert.ok(names.every((name) => name.length <= 64), `index name exceeds MySQL's 64-character limit: ${names.find((name) => name.length > 64)}`);
  assert.match(schema, /@@unique\(\[organizationId, reviewerId, assignmentId, formVersionId\], map: "ReviewDraft_scope_key"\)/);
  assert.match(migration, /information_schema\.statistics/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `ReviewDraft`/);
});
