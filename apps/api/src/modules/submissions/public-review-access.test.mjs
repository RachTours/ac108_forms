import assert from "node:assert/strict";
import test from "node:test";
import { assertPublicReviewAccess } from "../../../dist/modules/submissions/public-review-access.js";

const activeLink = {
  organizationId: "org-a",
  reviewerOrganizationId: "org-a",
  reviewerRole: "REVIEWER",
  reviewerStatus: "ACTIVE",
  revokedAt: null,
  expiresAt: null,
};

test("public review access use case grants reads and submissions for an active tenant-scoped reviewer link", () => {
  assert.doesNotThrow(() => assertPublicReviewAccess(activeLink, "read", new Date("2026-10-23T00:00:00.000Z")));
  assert.doesNotThrow(() => assertPublicReviewAccess(activeLink, "submit", new Date("2026-10-23T00:00:00.000Z")));
});

test("public review access use case rejects invalid credentials and cross-organization reviewer membership", () => {
  const now = new Date("2026-10-23T00:00:00.000Z");
  for (const link of [
    { ...activeLink, revokedAt: now },
    { ...activeLink, expiresAt: now },
    { ...activeLink, reviewerStatus: "ARCHIVED" },
    { ...activeLink, reviewerRole: "ADMIN" },
    { ...activeLink, reviewerOrganizationId: "org-b" },
  ]) {
    assert.throws(
      () => assertPublicReviewAccess(link, "read", now),
      (error) => error?.status === 404 && error?.code === "LINK_NOT_FOUND",
    );
  }
});
