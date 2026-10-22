export type AssignmentTarget = {
  id: string;
  displayName: string;
  email: string | null;
  assignedReviewer: { membershipId: string; displayName: string; email: string } | null;
  submissionCount: number;
};

export type AssignmentFilter = "all" | "unassigned" | "in-progress" | "completed" | `reviewer:${string}`;

export function filterAssignmentTargets<T extends AssignmentTarget>(targets: T[], search: string, filter: AssignmentFilter): T[] {
  const query = search.trim().toLocaleLowerCase();
  return targets.filter((target) => {
    const matchesSearch = !query || `${target.displayName} ${target.email ?? ""} ${target.assignedReviewer?.displayName ?? ""}`.toLocaleLowerCase().includes(query);
    if (!matchesSearch) return false;
    if (filter === "unassigned") return target.assignedReviewer === null;
    if (filter === "completed") return target.submissionCount > 0;
    if (filter === "in-progress") return target.assignedReviewer !== null && target.submissionCount === 0;
    if (filter.startsWith("reviewer:")) return target.assignedReviewer?.membershipId === filter.slice("reviewer:".length);
    return true;
  });
}

export function assignmentCounts<T extends AssignmentTarget>(targets: T[]) {
  return {
    all: targets.length,
    unassigned: targets.filter((target) => !target.assignedReviewer).length,
    inProgress: targets.filter((target) => target.assignedReviewer && target.submissionCount === 0).length,
    completed: targets.filter((target) => target.submissionCount > 0).length,
  };
}
