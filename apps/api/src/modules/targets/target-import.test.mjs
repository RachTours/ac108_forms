import assert from "node:assert/strict";
import test from "node:test";
import { parseTargetImport } from "../../../dist/modules/targets/target-import.js";
import { validateTargetImport } from "../../../dist/modules/targets/target-import.js";
import { commitTargetImport } from "../../../dist/modules/targets/target-import.js";

test("parses quoted CSV fields, CRLF, and embedded newlines", () => {
  const result = parseTargetImport('name,email\r\n"Ada, Lovelace",ada@example.com\r\n"Grace\nHopper",\r\n');
  assert.deepEqual(result.rows, [
    { rowNumber: 2, displayName: "Ada, Lovelace", email: "ada@example.com" },
    { rowNumber: 3, displayName: "Grace\nHopper", email: "" },
  ]);
  assert.deepEqual(result.errors, []);
});

test("preserves physical CSV row numbers across blank lines and returns malformed rows for preview", () => {
  const result = parseTargetImport("name,email\nAda,ada@example.com\n\nBroken,extra,column\nGrace,");
  assert.deepEqual(result.rows.map((row) => row.rowNumber), [2, 4, 5]);
  assert.deepEqual(result.errors, [{ rowNumber: 4, message: "Each row must contain exactly name and email." }]);
});

test("rejects absent or extra headers and malformed CSV", () => {
  assert.match(parseTargetImport("email,name\na@example.com,Ada").errors[0].message, /headers/i);
  assert.match(parseTargetImport("name,email,role\nAda,a@example.com,admin").errors[0].message, /headers/i);
  assert.match(parseTargetImport('name,email\n"Ada,a@example.com').errors[0].message, /quoted/i);
  assert.match(parseTargetImport('name,email\n"Ada"x,a@example.com').errors[0].message, /quoted/i);
});

test("flags normalized emails already held by active people", async () => {
  let query;
  const result = await validateTargetImport({ reviewTarget: { findMany: async (input) => { query = input; return [{ email: "ADA@example.com" }]; } } }, "workspace-1", "name,email\nAda,ada@example.com");
  assert.deepEqual(result.errors, [{ rowNumber: 2, message: "Email already belongs to an active person." }]);
  assert.deepEqual(query, { where: { organizationId: "workspace-1", status: "ACTIVE", archivedAt: null, email: { in: ["ada@example.com"] } }, select: { email: true } });
});

test("reports invalid names, emails, and more than 500 data rows", () => {
  assert.match(parseTargetImport("name,email\n,ada@example.com").errors[0].message, /name/i);
  assert.match(parseTargetImport("name,email\nAda,not-an-email").errors[0].message, /email/i);
  const rows = Array.from({ length: 501 }, (_, index) => `Person ${index},`).join("\n");
  assert.match(parseTargetImport(`name,email\n${rows}`).errors[0].message, /500/i);
  const maxRows = Array.from({ length: 500 }, (_, index) => `Person ${index},`).join("\n");
  assert.equal(parseTargetImport(`name,email\n${maxRows}`).rows.length, 500);
});

test("normalizes duplicate nonempty emails while allowing blank emails and duplicate names", () => {
  const result = parseTargetImport("name,email\nAda, ADA@example.com \nAda,ada@EXAMPLE.com\nAda,\nAda,");
  assert.equal(result.rows.length, 4);
  assert.deepEqual(result.errors.map((error) => error.rowNumber), [3]);
  assert.match(result.errors[0].message, /duplicate/i);
});

test("commit writes only valid rows, assigns them, and audits counts without CSV content", async () => {
  const writes = []; let assigned = [];
  const transaction = { reviewTarget: { findMany: async () => [], create: async (input) => { writes.push(input); return { id: `person-${writes.length}` }; } }, auditEvent: { create: async (input) => writes.push(input) } };
  const result = await commitTargetImport(transaction, { organizationId: "workspace-1", actorId: "user-1", csv: "name,email\nAda,ada@example.com\nGrace," }, async (ids) => { assigned = ids; return [{}]; });
  assert.deepEqual(result, { importedCount: 2, assignedCount: 1 });
  assert.deepEqual(assigned, ["person-1", "person-2"]);
  assert.equal(writes.length, 3);
  assert.deepEqual(writes[2].data.metadata, { importedCount: 2, assignedCount: 1 });
});

test("invalid commit performs no creates, assignments, or audit writes", async () => {
  let writes = 0; let assigned = 0;
  const transaction = { reviewTarget: { findMany: async () => [], create: async () => { writes += 1; return { id: "person-1" }; } }, auditEvent: { create: async () => { writes += 1; } } };
  await assert.rejects(() => commitTargetImport(transaction, { organizationId: "workspace-1", actorId: "user-1", csv: "name,email\n,invalid" }, async () => { assigned += 1; return []; }), { code: "TARGET_IMPORT_INVALID" });
  assert.equal(writes, 0); assert.equal(assigned, 0);
});
