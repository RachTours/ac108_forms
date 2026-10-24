import assert from "node:assert/strict";
import test from "node:test";
import { loadPublicReview } from "./public-review-load.ts";

test("revoked or expired public links produce an unavailable result instead of aborting the server component", async () => {
  for (const status of [404, 410]) {
    const result = await loadPublicReview(async () => new Response(null, { status }));
    assert.deepEqual(result, { kind: "unavailable" });
  }
});

test("unexpected API failures return a retryable error and safe request reference", async () => {
  const result = await loadPublicReview(async () => new Response(null, { status: 503, headers: { "x-request-id": "request-123" } }));
  assert.deepEqual(result, { kind: "error", requestId: "request-123" });
});

test("network failures return a retryable error instead of aborting the server component", async () => {
  const result = await loadPublicReview(async () => { throw new Error("network down"); });
  assert.deepEqual(result, { kind: "error" });
});

test("untrusted request references are not surfaced", async () => {
  const result = await loadPublicReview(async () => new Response(null, { status: 429, headers: { "x-request-id": "token/secret" } }));
  assert.deepEqual(result, { kind: "error" });
});

test("malformed successful API responses return the retryable error state", async () => {
  const result = await loadPublicReview(async () => Response.json({ unexpected: true }));
  assert.deepEqual(result, { kind: "error" });
});

test("valid public review data is returned", async () => {
  const data = { reviewerName: "Reviewer", targets: [], forms: [] };
  const result = await loadPublicReview(async () => Response.json({ data }));
  assert.deepEqual(result, { kind: "ready", data });
});
