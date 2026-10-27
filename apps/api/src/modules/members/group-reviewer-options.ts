type ReviewerMember = { id: string; user: { displayName: string } };
type ReviewerSubmissionCount = { reviewerId: string; _count: { _all: number } };

export function toGroupReviewerOptions(
  currentMembers: ReviewerMember[],
  submissionCounts: ReviewerSubmissionCount[],
  historicalMembers: ReviewerMember[],
) {
  const members = new Map<string, ReviewerMember>();
  for (const member of [...currentMembers, ...historicalMembers]) members.set(member.id, member);
  const counts = new Map(submissionCounts.map(({ reviewerId, _count }) => [reviewerId, _count._all]));
  return [...members.values()]
    .map((member) => ({ reviewerId: member.id, reviewerName: member.user.displayName, submissionCount: counts.get(member.id) ?? 0 }))
    .sort((a, b) => a.reviewerName.localeCompare(b.reviewerName) || a.reviewerId.localeCompare(b.reviewerId));
}
