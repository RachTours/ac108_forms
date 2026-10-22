import assert from "node:assert/strict";
import test from "node:test";
import { resolveServerApiOrigin } from "./server-api-origin.ts";

test("requires a reachable API origin in production", () => {
  assert.throws(() => resolveServerApiOrigin(undefined, "production"), /API_INTERNAL_URL/);
});

test("keeps the localhost API default for local development", () => {
  assert.equal(resolveServerApiOrigin(undefined, "development"), "http://localhost:4000");
});

test("normalizes the configured API origin", () => {
  assert.equal(resolveServerApiOrigin(" https://api.example.com/ ", "production"), "https://api.example.com");
});
