export function getSubmissionCompletionPercent(submissionCount: number, targetCount: number): number {
  if (!Number.isFinite(targetCount) || targetCount <= 0) return 0;
  return Math.min(100, Math.round((submissionCount / targetCount) * 1000) / 10);
}

export function getWorkspaceSubmissionGoal(configuredGoal: number | null | undefined): number {
  return typeof configuredGoal === "number" && Number.isInteger(configuredGoal) && configuredGoal > 0 ? configuredGoal : 50;
}

export function getReviewerSubmissionGoal(submissionGoal: number, activeReviewerCount: number): number | null {
  if (!Number.isInteger(activeReviewerCount) || activeReviewerCount <= 0) return null;
  return submissionGoal / activeReviewerCount;
}

export function getReviewerSubmissionMetrics(submissionCount: number, submissionGoal: number, activeReviewerCount: number, override?: number | null) {
  const reviewerSubmissionGoal = override != null && Number.isInteger(override) && override > 0 ? override : getReviewerSubmissionGoal(submissionGoal, activeReviewerCount);
  if (reviewerSubmissionGoal === null) {
    return {
      reviewerSubmissionGoal: null,
      submissionRatio: null,
      submissionsRemaining: null,
      submissionPercent: 0,
      submissionGoalMet: false,
    };
  }
  const submissionRatio = Math.min(1, submissionCount / reviewerSubmissionGoal);
  return {
    reviewerSubmissionGoal,
    submissionRatio,
    submissionsRemaining: Math.max(0, Math.ceil(reviewerSubmissionGoal - submissionCount)),
    submissionPercent: Math.min(100, Math.round(submissionRatio * 1000) / 10),
    submissionGoalMet: submissionCount >= reviewerSubmissionGoal,
  };
}
