import test from "node:test";
import assert from "node:assert/strict";
import { canReviewerRevealLink } from "../../../dist/modules/links/reviewer-reveal.js";

const now = new Date("2026-10-22T12:00:00Z");
const activeLink = {
  organizationId: "org-1", reviewerId: "member-1", formId: "form-1",
  revokedAt: null, expiresAt: new Date("2026-11-01T00:00:00Z"),
  reviewerRole: "REVIEWER", reviewerStatus: "ACTIVE",
  formStatus: "PUBLISHED", formArchivedAt: null,
};
const scope = { organizationId: "org-1", reviewerId: "member-1", formId: "form-1" };

test("reviewer can reveal their active link for a published form", () => {
  assert.equal(canReviewerRevealLink(activeLink, scope, now), true);
});

test("reviewer cannot reveal another member or workspace link", () => {
  assert.equal(canReviewerRevealLink(activeLink, { ...scope, reviewerId: "member-2" }, now), false);
  assert.equal(canReviewerRevealLink(activeLink, { ...scope, organizationId: "org-2" }, now), false);
});

test("revoked, expired, or unpublished links cannot be revealed", () => {
  assert.equal(canReviewerRevealLink({ ...activeLink, revokedAt: now }, scope, now), false);
  assert.equal(canReviewerRevealLink({ ...activeLink, expiresAt: now }, scope, now), false);
  assert.equal(canReviewerRevealLink({ ...activeLink, formStatus: "DRAFT" }, scope, now), false);
});
