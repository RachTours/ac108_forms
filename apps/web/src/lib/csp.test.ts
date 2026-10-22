import assert from "node:assert/strict";
import test from "node:test";
import { createContentSecurityPolicy } from "./csp.ts";

test("production CSP permits only nonce-authorized scripts and blocks framing and plugins", () => {
  const policy = createContentSecurityPolicy("random-nonce", false);
  assert.match(policy, /script-src[^;]*'nonce-random-nonce'/);
  assert.match(policy, /script-src[^;]*'strict-dynamic'/);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-(?:inline|eval)'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
});

test("development CSP allows Next.js development eval diagnostics", () => {
  assert.match(createContentSecurityPolicy("dev-nonce", true), /'unsafe-eval'/);
});
