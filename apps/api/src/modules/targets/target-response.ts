type CreatedTarget = {
  id: string;
  displayName: string;
  email: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type UpdatedTarget = {
  id: string;
  displayName: string;
  email: string | null;
};

type AssignedReviewerSummary = {
  membershipId: string;
  displayName: string;
  email: string;
} | null;

/** Project a persistence model onto the public target-create response contract. */
export function toCreatedTargetSummary(target: CreatedTarget, assignedReviewer: AssignedReviewerSummary) {
  return {
    id: target.id,
    displayName: target.displayName,
    email: target.email,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
    submissionCount: 0,
    assignedReviewer,
  };
}

/** Project a persistence model onto the strict public target-update response contract. */
export function toUpdatedTargetSummary(target: UpdatedTarget) {
  return {
    id: target.id,
    displayName: target.displayName,
    email: target.email,
  };
}
