export type AssignmentState = "all" | "assigned" | "unassigned";

export type ReviewerMemberCandidate = {
  id: string;
  role: "OWNER" | "ADMIN" | "REVIEWER";
  status: "ACTIVE" | "ARCHIVED";
  user: { status: "ACTIVE" | "ARCHIVED" };
};

export function selectEligibleReviewers<T extends ReviewerMemberCandidate>(members: T[]): T[] {
  return members.filter((member) => member.role === "REVIEWER" && member.status === "ACTIVE" && member.user.status === "ACTIVE");
}

export function buildAssignmentListUrl(input: { search: string; state: AssignmentState; reviewerId: string; cursor: string | null; limit?: number }) {
  const query = new URLSearchParams();
  const search = input.search.trim();
  if (search) query.set("search", search);
  if (input.state !== "all") query.set("state", input.state);
  if (input.reviewerId) query.set("reviewerId", input.reviewerId);
  if (input.cursor) query.set("cursor", input.cursor);
  query.set("limit", String(input.limit ?? 25));
  return `/assignments?${query.toString()}`;
}

export function readAssignmentFilters(search: string) {
  const query = new URLSearchParams(search);
  const state = query.get("state");
  return {
    search: query.get("search") ?? "",
    state: state === "assigned" || state === "unassigned" ? state : "all" as AssignmentState,
    reviewerId: query.get("reviewerId") ?? "",
  };
}
