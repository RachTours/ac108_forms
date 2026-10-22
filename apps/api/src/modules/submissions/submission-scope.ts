export function requestedReviewerScope(role: string, membershipId: string, requestedReviewerId?: string): string | undefined {
  return role === "REVIEWER" ? membershipId : requestedReviewerId;
}
