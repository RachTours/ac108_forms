import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OpenAPI documents every current API route family and representative schemas", async () => {
  const document = await readFile(new URL("../../../docs/rebuild/openapi.yaml", import.meta.url), "utf8");
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
});
