import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";
import { assignmentSetRequestSchema, loginRequestSchema, loginResponseSchema } from "../dist/index.js";

test("OpenAPI documents every current API route family and representative schemas", async () => {
  const document = await readFile(new URL("../../../docs/rebuild/openapi.yaml", import.meta.url), "utf8");
  const openapi = parse(document);
  assert.equal(openapi.openapi, "3.1.0");
  for (const route of [
    "/auth/login", "/auth/session", "/auth/password-reset", "/members", "/members/invitations",
    "/review-targets", "/assignments", "/forms", "/review-links", "/public/review/{token}",
    "/submissions", "/progress/summary", "/organization/theme", "/audit-events", "/health/ready",
  ]) assert.ok(document.includes(`  ${route}:`), `missing documented route ${route}`);
  for (const schema of ["ApiError", "ListQuery", "MemberSummary", "TargetSummary", "FormSummary", "ReviewLinkSummary", "SubmissionSummary", "ProgressSummary", "OrganizationTheme", "AuditEventSummary"]) {
    assert.ok(document.includes(`    ${schema}:`), `missing documented schema ${schema}`);
  }
  assert.match(document, /additionalProperties:\s*false/);
  assert.doesNotMatch(document, /passwordHash|encryptedToken|tokenHash/);

  const fixtures = [
    ["/auth/admin/login", "post", loginRequestSchema],
    ["/auth/login", "post", loginRequestSchema],
    ["/assignments/{targetId}", "put", assignmentSetRequestSchema],
  ];
  for (const [path, method, contract] of fixtures) {
    const mediaType = openapi.paths[path]?.[method]?.requestBody?.content?.["application/json"];
    assert.ok(mediaType?.schema?.$ref, `${method.toUpperCase()} ${path} must reference a contract schema`);
    assert.ok(mediaType.example, `${method.toUpperCase()} ${path} must include a representative request example`);
    const schemaName = mediaType.schema.$ref.split("/").at(-1);
    assert.ok(openapi.components.schemas[schemaName], `missing OpenAPI schema ${schemaName}`);
    const result = contract.safeParse(mediaType.example);
    assert.equal(result.success, true, `${method.toUpperCase()} ${path} OpenAPI example must satisfy the shared Zod contract`);
  }

  const loginResponse = openapi.paths["/auth/admin/login"].post.responses["200"].content["application/json"];
  assert.equal(loginResponseSchema.safeParse(loginResponse.example).success, true, "admin login response example must satisfy the shared Zod contract");
  assert.equal(loginResponseSchema.safeParse({ ...loginResponse.example, passwordHash: "must-not-appear" }).success, false);
});
