import assert from "node:assert/strict";
import test from "node:test";
import { invitationEmailError } from "./invitation-acceptance-validation.ts";

test("explains that email addresses with numeric-only top-level domains are invalid", () => {
  assert.equal(invitationEmailError("fatima@ac.108"), "Enter a valid email address, such as name@example.com.");
});

test("accepts a valid email address and trims surrounding whitespace", () => {
  assert.equal(invitationEmailError("  fatima@example.com  "), null);
});
