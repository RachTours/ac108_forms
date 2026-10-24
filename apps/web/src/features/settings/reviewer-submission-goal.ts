export function formatReviewerSubmissionGoal(submissionGoal: number, activeReviewerCount: number): string {
  if (activeReviewerCount <= 0) return "Add an active reviewer to calculate the shared submission goal.";
  const perReviewer = submissionGoal / activeReviewerCount;
  const formatted = Number.isInteger(perReviewer) ? String(perReviewer) : perReviewer.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${submissionGoal} submissions ÷ ${activeReviewerCount} active reviewers = ${formatted} submissions per reviewer.`;
}
