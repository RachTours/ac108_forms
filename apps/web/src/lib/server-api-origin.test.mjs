import assert from "node:assert/strict";
import test from "node:test";
import { resolveServerApiOrigin } from "./server-api-origin.ts";

test("requires a reachable API origin in production", () => {
  assert.throws(() => resolveServerApiOrigin(undefined, "production"), /API_INTERNAL_URL/);
});

test("rejects a loopback API origin in production because the API runs as a separate service", () => {
  assert.throws(() => resolveServerApiOrigin("http://127.0.0.1:4000", "production"), /separate API service/);
  assert.throws(() => resolveServerApiOrigin("http://localhost:4000", "production"), /separate API service/);
});

test("requires HTTPS for the production API origin", () => {
  assert.throws(() => resolveServerApiOrigin("http://api.example.com", "production"), /must use HTTPS/);
});

test("keeps the localhost API default for local development", () => {
  assert.equal(resolveServerApiOrigin(undefined, "development"), "http://localhost:4000");
});

test("normalizes the configured API origin", () => {
  assert.equal(resolveServerApiOrigin(" https://api.example.com/ ", "production"), "https://api.example.com");
});
