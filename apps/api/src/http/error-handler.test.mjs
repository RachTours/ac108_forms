import test from "node:test";
import assert from "node:assert/strict";
import { errorHandler } from "../../dist/http/error-handler.js";

test("unexpected errors return a generic response and log safe request diagnostics", () => {
  const lines = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = (chunk) => { lines.push(String(chunk)); return true; };
  const response = {
    locals: { requestId: "req-safe-123" },
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const request = {
    method: "POST",
    route: { path: "/api/v1/public/review/:token/submissions" },
    originalUrl: "/api/v1/public/review/super-secret-token/submissions?password=do-not-log",
  };

  try {
    errorHandler(new Error("database failed for password=hunter2 at /public/review/super-secret-token-123456789012345678901234567890/submissions"), request, response, () => {});
  } finally {
    process.stderr.write = originalWrite;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId: "req-safe-123" } });
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]);
  assert.equal(event.event, "http.unhandled_error");
  assert.equal(event.requestId, "req-safe-123");
  assert.equal(event.method, "POST");
  assert.equal(event.route, "/api/v1/public/review/:token/submissions");
  assert.doesNotMatch(lines[0], /super-secret-token|hunter2|do-not-log|originalUrl|123456789012345678901234567890|database failed/);
});

test("expected client errors are not logged", async () => {
  const { HttpError } = await import("../../dist/http/errors.js");
  const originalWrite = process.stderr.write;
  let writes = 0;
  process.stderr.write = () => { writes += 1; return true; };
  const response = { locals: {}, statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
  try {
    errorHandler(new HttpError(403, "FORBIDDEN", "Forbidden."), { method: "GET", route: { path: "/admin" } }, response, () => {});
  } finally {
    process.stderr.write = originalWrite;
  }
  assert.equal(response.statusCode, 403);
  assert.equal(writes, 0);
});
