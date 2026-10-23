export type AssignmentReviewerCandidate = {
  id: string;
  organizationId: string;
  role: "OWNER" | "ADMIN" | "REVIEWER";
  status: "ACTIVE" | "ARCHIVED";
  userStatus: "ACTIVE" | "ARCHIVED";
  load: number;
  stableOrder: string;
};

export type AssignmentTargetState = {
  organizationId: string;
  status: "ACTIVE" | "ARCHIVED";
  archivedAt: Date | string | null;
};

export type CurrentAssignmentState = {
  organizationId: string;
  reviewerEligible: boolean;
};

/** Only active, same-tenant targets without a valid current reviewer enter balancing. */
export function canAutoAssignTarget(
  organizationId: string,
  target: AssignmentTargetState,
  assignment: CurrentAssignmentState | null,
): boolean {
  if (target.organizationId !== organizationId || target.status !== "ACTIVE" || target.archivedAt !== null) return false;
  if (!assignment) return true;
  if (assignment.organizationId !== organizationId) return false;
  return !assignment.reviewerEligible;
}

/** Match the displayed version; null-version replacement is allowed only for an inactive prior reviewer. */
export function canApplyAssignmentVersion(
  currentUpdatedAt: number | null,
  expectedUpdatedAt: number | null,
  currentReviewerEligible: boolean,
): boolean {
  if (currentUpdatedAt === expectedUpdatedAt) return true;
  return currentUpdatedAt !== null && expectedUpdatedAt === null && !currentReviewerEligible;
}

/**
 * Choose the least-loaded active reviewer in the target organization.
 * Ties are stable across calls: membership creation order, then membership ID.
 * Returns null when no eligible reviewer exists and never mutates its input.
 */
export function selectLeastLoadedReviewer(
  organizationId: string,
  candidates: readonly AssignmentReviewerCandidate[],
): AssignmentReviewerCandidate | null {
  let selected: AssignmentReviewerCandidate | null = null;
  for (const candidate of candidates) {
    if (candidate.organizationId !== organizationId || candidate.role !== "REVIEWER" || candidate.status !== "ACTIVE" || candidate.userStatus !== "ACTIVE") continue;
    if (!Number.isSafeInteger(candidate.load) || candidate.load < 0) continue;
    if (!selected || candidate.load < selected.load ||
      (candidate.load === selected.load && (candidate.stableOrder < selected.stableOrder ||
        (candidate.stableOrder === selected.stableOrder && candidate.id < selected.id)))) {
      selected = candidate;
    }
  }
  return selected;
}
