import assert from "node:assert/strict";
import test from "node:test";
import { audienceForRequestPath } from "./audience-routing.ts";

test("admin and reviewer route families always choose their own session audience", () => {
  for (const path of ["/admin", "/admin/login", "/admin/team", "/people", "/team", "/forms", "/settings"]) {
    assert.equal(audienceForRequestPath(path), "admin", path);
  }
  for (const path of ["/reviewer", "/reviewer/login", "/reviewer/forms", "/reviewer/submissions/123", "/my-link"]) {
    assert.equal(audienceForRequestPath(path), "reviewer", path);
  }
});

test("public review links and reset links derive audience without borrowing another session", () => {
  assert.equal(audienceForRequestPath("/r/token"), "reviewer");
  assert.equal(audienceForRequestPath("/invite/token"), "admin");
  assert.equal(audienceForRequestPath("/reset-password", "reviewer"), "reviewer");
  assert.equal(audienceForRequestPath("/reset-password", "admin"), "admin");
  assert.equal(audienceForRequestPath("/reset-password", "unknown"), "admin");
});

test("path matching uses segment boundaries and does not classify lookalike URLs", () => {
  assert.equal(audienceForRequestPath("/reviewer-tools"), "admin");
  assert.equal(audienceForRequestPath("/my-linkage"), "admin");
  assert.equal(audienceForRequestPath("/rando"), "admin");
});
