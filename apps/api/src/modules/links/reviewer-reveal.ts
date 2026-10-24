type RevealLink = {
  organizationId: string;
  reviewerId: string;
  formId: string | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
  reviewerRole: string;
  reviewerStatus: string;
  formStatus: string | null;
  formArchivedAt: Date | null;
};

type RevealScope = { organizationId: string; reviewerId: string; formId: string };

export function canReviewerRevealLink(link: RevealLink, scope: RevealScope, now = new Date()): boolean {
  return link.organizationId === scope.organizationId
    && link.reviewerId === scope.reviewerId
    && link.formId === scope.formId
    && link.revokedAt === null
    && (link.expiresAt === null || link.expiresAt > now)
    && link.reviewerRole === "REVIEWER"
    && link.reviewerStatus === "ACTIVE"
    && link.formStatus === "PUBLISHED"
    && link.formArchivedAt === null;
}
