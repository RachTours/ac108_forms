import assert from "node:assert/strict";
import test from "node:test";
import {
  adminSessionCookieName,
  legacySessionCookieName,
  reviewerSessionCookieName,
  sessionCookieNameForRequest,
  setSessionCookie,
} from "../../../dist/modules/auth/session.js";

test("admin and reviewer sessions can coexist and are selected by the request audience", () => {
  const cookies = {
    [adminSessionCookieName]: "admin-session-token",
    [reviewerSessionCookieName]: "reviewer-session-token",
  };

  assert.equal(sessionCookieNameForRequest(cookies, "admin"), adminSessionCookieName);
  assert.equal(sessionCookieNameForRequest(cookies, "reviewer"), reviewerSessionCookieName);
});

test("an unrelated audience cookie cannot be used when the requested session is absent", () => {
  assert.equal(
    sessionCookieNameForRequest({ [reviewerSessionCookieName]: "reviewer-session-token" }, "admin"),
    adminSessionCookieName,
  );
});

test("legacy session is selected only when no audience-specific session exists", () => {
  assert.equal(sessionCookieNameForRequest({ [legacySessionCookieName]: "legacy-token" }, "reviewer"), legacySessionCookieName);
  assert.equal(
    sessionCookieNameForRequest({ [adminSessionCookieName]: "admin-token", [legacySessionCookieName]: "legacy-token" }, "reviewer"),
    reviewerSessionCookieName,
  );
});

test("admin login writes only the admin audience cookie and leaves reviewer session untouched", () => {
  const written = [];
  const cleared = [];
  setSessionCookie({ cookie: (...args) => written.push(args), clearCookie: (...args) => cleared.push(args) }, "admin-secret", "admin");
  assert.deepEqual(written.map(([name, value]) => [name, value]), [[adminSessionCookieName, "admin-secret"]]);
  assert.deepEqual(cleared.map(([name]) => name), [legacySessionCookieName]);
  assert.equal(written[0][2].httpOnly, true);
  assert.equal(written[0][2].path, "/");
});

test("reviewer login writes only the reviewer audience cookie and leaves admin session untouched", () => {
  const written = [];
  const cleared = [];
  setSessionCookie({ cookie: (...args) => written.push(args), clearCookie: (...args) => cleared.push(args) }, "reviewer-secret", "reviewer");
  assert.deepEqual(written.map(([name, value]) => [name, value]), [[reviewerSessionCookieName, "reviewer-secret"]]);
  assert.deepEqual(cleared.map(([name]) => name), [legacySessionCookieName]);
  assert.equal(written[0][2].httpOnly, true);
  assert.equal(written[0][2].path, "/");
});
