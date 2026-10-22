export type ReviewerMembership = { id: string; role: string; status: string; user: { displayName: string; email: string } };

export function activeReviewers<T extends ReviewerMembership>(members: T[]): T[] {
  return members.filter((member) => member.role === "REVIEWER" && member.status === "ACTIVE");
}
