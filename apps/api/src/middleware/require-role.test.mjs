import assert from "node:assert/strict";
import test from "node:test";
import { requireRole } from "../../dist/middleware/require-role.js";

function authorize(role, allowedRoles) {
  let nextError;
  let nextCalled = false;
  const middleware = requireRole(...allowedRoles);
  middleware({ auth: role ? { role } : undefined }, {}, (error) => { nextError = error; nextCalled = true; });
  return { nextError, nextCalled };
}

test("reviewers are denied administrative routes by the shared API role guard", () => {
  const result = authorize("REVIEWER", ["OWNER", "ADMIN"]);
  assert.equal(result.nextCalled, true);
  assert.equal(result.nextError.status, 403);
  assert.equal(result.nextError.code, "FORBIDDEN");
});

test("owner and admin roles pass the administrative API guard", () => {
  for (const role of ["OWNER", "ADMIN"]) {
    const result = authorize(role, ["OWNER", "ADMIN"]);
    assert.equal(result.nextCalled, true);
    assert.equal(result.nextError, undefined);
  }
});
