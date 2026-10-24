export function getCompletionPercent(completedTargets: number, targetCount: number): number {
  if (targetCount <= 0) return 0;
  return Math.min(100, Math.round((completedTargets / targetCount) * 100));
}
