export type ReviewerProgress = {
  reviewerId: string;
  displayName: string;
  assigned: number;
  completed: number;
  submissionCount?: number;
  reviewerSubmissionGoal?: number | null;
  submissionRatio?: number | null;
  submissionsRemaining?: number | null;
  submissionPercent?: number;
  submissionGoalMet?: boolean;
  assignmentRemaining: number;
  remaining: number;
  percent: number;
  submissionStatus?: string;
  assignmentStatus: string;
};
export type ReviewerSort = "completion" | "name" | "completed" | "remaining";

export function getReviewerSortHint(reviewerCount: number): string | null {
  return reviewerCount < 2 ? "Add another active reviewer to compare sort orders." : null;
}

export function getPeopleRemainingForGoal(targetGoal: number, activeTargets: number): number {
  return Math.max(0, targetGoal - activeTargets);
}

export function toReviewerProgress(rows: Array<{
  reviewerId: string;
  displayName: string;
  assigned: number;
  completed: number;
  submissionCount?: number;
  reviewerSubmissionGoal?: number | null;
  submissionRatio?: number | null;
  submissionsRemaining?: number | null;
  submissionPercent?: number;
  submissionGoalMet?: boolean;
}>, targetGoal?: number): ReviewerProgress[] {
  return rows.map((row) => {
    const assignmentRemaining = Math.max(0, row.assigned - row.completed);
    const hasSubmissionMetrics = row.submissionCount !== undefined;
    const remaining = hasSubmissionMetrics ? row.submissionsRemaining ?? 0 : assignmentRemaining;
    const percent = hasSubmissionMetrics
      ? row.submissionPercent ?? 0
      : targetGoal !== undefined ? targetGoal > 0 ? Math.min(100, Math.round((row.completed / targetGoal) * 100)) : 0 : row.assigned > 0 ? Math.round((row.completed / row.assigned) * 100) : 0;
    const submissionStatus = hasSubmissionMetrics
      ? row.submissionGoalMet ? "Goal met" : row.reviewerSubmissionGoal == null ? "No reviewer goal" : `${remaining} submission${remaining === 1 ? "" : "s"} left`
      : undefined;
    return {
      ...row,
      assignmentRemaining,
      remaining,
      percent,
      ...(submissionStatus === undefined ? {} : { submissionStatus }),
      assignmentStatus: row.assigned === 0 ? "No assignments" : assignmentRemaining === 0 ? "Assigned work done" : `${assignmentRemaining} assigned remaining`,
    };
  });
}

export function getTeamReviewerProgress(rows: Array<{ reviewerId: string; displayName: string; assigned: number; completed: number }>) {
  const eligible = rows.filter((row) => row.assigned > 0);
  const completedReviewers = eligible.filter((row) => row.completed >= row.assigned).length;
  return { totalReviewers: eligible.length, completedReviewers, percent: eligible.length ? Math.round((completedReviewers / eligible.length) * 100) : 0 };
}

export function sortReviewerProgress(rows: ReviewerProgress[], sort: ReviewerSort): ReviewerProgress[] {
  const byName = (a: ReviewerProgress, b: ReviewerProgress) => a.displayName.localeCompare(b.displayName) || a.reviewerId.localeCompare(b.reviewerId);
  return [...rows].sort((a, b) => {
    if (sort === "name") return byName(a, b);
    if (sort === "completed") return (b.submissionCount ?? b.completed) - (a.submissionCount ?? a.completed) || byName(a, b);
    if (sort === "remaining") return a.remaining - b.remaining || byName(a, b);
    return (b.submissionRatio ?? b.percent / 100) - (a.submissionRatio ?? a.percent / 100) || byName(a, b);
  });
}
