import { authorize } from "@reviewroom/domain";
import { HttpError } from "../../http/errors.js";

type PublicReviewLink = {
  organizationId: string;
  reviewerOrganizationId: string;
  reviewerRole: string;
  reviewerStatus: string;
  revokedAt: Date | null;
  expiresAt: Date | null;
};

export function assertPublicReviewAccess(
  link: PublicReviewLink,
  action: "read" | "submit",
  now = new Date(),
): void {
  const credentialIsActive = link.revokedAt === null
    && (link.expiresAt === null || link.expiresAt > now)
    && link.reviewerStatus === "ACTIVE"
    && link.reviewerRole === "REVIEWER"
    && link.reviewerOrganizationId === link.organizationId;
  const permission = authorize({
    role: "PUBLIC",
    organizationId: link.organizationId,
    requestedOrganizationId: link.organizationId,
    publicCredentialStatus: credentialIsActive ? "ACTIVE" : "INACTIVE",
    resource: "publicReview",
    action,
  });
  if (!permission.allowed) throw new HttpError(404, "LINK_NOT_FOUND", "This review link is unavailable.");
}
