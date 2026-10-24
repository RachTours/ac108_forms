import assert from "node:assert/strict";
import test from "node:test";
import { activeReviewerKey, allowsForm, calculateLinkExpiry } from "../../../dist/modules/links/review-link-scope.js";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("form-scoped links can submit only their selected form", () => {
  assert.equal(allowsForm(uuid(2), uuid(2)), true);
  assert.equal(allowsForm(uuid(2), uuid(3)), false);
});

test("legacy links with no form scope retain access to published forms", () => {
  assert.equal(allowsForm(null, uuid(2)), true);
});

test("active key is unique per reviewer and form while keeping legacy key stable", () => {
  assert.equal(activeReviewerKey(uuid(1), null), uuid(1));
  assert.equal(activeReviewerKey(uuid(1), uuid(2)), `${uuid(1)}:${uuid(2)}`);
  assert.notEqual(activeReviewerKey(uuid(1), uuid(2)), activeReviewerKey(uuid(1), uuid(3)));
  assert.ok(activeReviewerKey(uuid(1), uuid(2)).length <= 73);
});

test("review link expiry is bounded and calculated from the selected duration", () => {
  const start = new Date("2026-10-22T00:00:00Z");
  assert.equal(calculateLinkExpiry(30, start).toISOString(), "2026-11-21T00:00:00.000Z");
  assert.throws(() => calculateLinkExpiry(0, start), RangeError);
  assert.throws(() => calculateLinkExpiry(366, start), RangeError);
});
