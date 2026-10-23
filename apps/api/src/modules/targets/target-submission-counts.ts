import type { Prisma } from "../../generated/prisma/client.js";

type SubmissionCountReader = Pick<Prisma.TransactionClient, "submission">;
type TargetAssignmentReader = Pick<Prisma.TransactionClient, "assignment">;

export type TargetAssignmentSummary = { membershipId: string; displayName: string; email: string };

/** Count this page's active submissions with one explicit, tenant-scoped GROUP BY query. */
export async function loadTargetSubmissionCounts(
  reader: SubmissionCountReader,
  organizationId: string,
  targetIds: string[],
): Promise<Map<string, number>> {
  if (targetIds.length === 0) return new Map();
  const groups = await reader.submission.groupBy({
    by: ["targetId"],
    where: { organizationId, archivedAt: null, targetId: { in: targetIds } },
    _count: { _all: true },
  });
  return new Map(groups.map(({ targetId, _count }) => [targetId, _count._all]));
}

/** Load the current eligible reviewer for only this bounded target page. */
export async function loadTargetAssignments(
  reader: TargetAssignmentReader,
  organizationId: string,
  targetIds: string[],
): Promise<Map<string, TargetAssignmentSummary>> {
  if (targetIds.length === 0) return new Map();
  const rows = await reader.assignment.findMany({
    where: {
      organizationId,
      targetId: { in: targetIds },
      target: { organizationId, status: "ACTIVE", archivedAt: null },
      reviewer: { organizationId, role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } },
    },
    orderBy: [{ targetId: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
    select: { targetId: true, reviewer: { select: { id: true, user: { select: { displayName: true, email: true } } } } },
  });
  return new Map(rows.map(({ targetId, reviewer }) => [targetId, {
    membershipId: reviewer.id,
    displayName: reviewer.user.displayName,
    email: reviewer.user.email,
  }]));
}
