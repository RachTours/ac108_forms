import type { Prisma } from "../../generated/prisma/client.js";

type SubmissionCountClient = Pick<Prisma.TransactionClient, "submission">;

/** Return non-archived submission counts for the current target page. */
export async function countSubmissionsByTarget(
  client: SubmissionCountClient,
  organizationId: string,
  targetIds: string[],
) {
  if (targetIds.length === 0) return new Map<string, number>();

  const groups = await client.submission.groupBy({
    by: ["targetId"],
    where: { organizationId, archivedAt: null, targetId: { in: targetIds } },
    _count: { _all: true },
  });
  return new Map(groups.map(({ targetId, _count }) => [targetId, _count._all]));
}
