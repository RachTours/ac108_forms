import type { Prisma } from "../../generated/prisma/client.js";

type SubmissionCountReader = Pick<Prisma.TransactionClient, "submission">;

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
