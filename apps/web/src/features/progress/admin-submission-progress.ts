type AdminSubmissionProgressInput = {
  groupWorkflowsEnabled?: boolean;
  groupGoalTotal?: number;
  groupSubmissionCount?: number;
  submissionGoal: number;
  responseCount: number;
  submissionCompletionPercent: number;
};

export function getAdminSubmissionProgress(input: AdminSubmissionProgressInput) {
  const usesGroupGoals = Boolean(input.groupWorkflowsEnabled || (input.groupGoalTotal ?? 0) > 0);
  const goal = usesGroupGoals ? input.groupGoalTotal ?? 0 : input.submissionGoal;
  const submissions = usesGroupGoals ? input.groupSubmissionCount ?? 0 : input.responseCount;
  return {
    goal,
    submissions,
    percent: goal > 0 ? Math.min(100, Number((submissions / goal * 100).toFixed(1))) : 0,
    usesGroupGoals,
  };
}
