import type { Prisma } from "../../generated/prisma/client.js";

type MemberCountReader = Pick<Prisma.TransactionClient, "assignment" | "reviewLink">;
export type MemberCounts = { assignments: number; reviewLinks: number };

/** Load page-bounded member totals using simple tenant-scoped GROUP BY queries. */
export async function loadMemberCounts(
  reader: MemberCountReader,
  organizationId: string,
  membershipIds: string[],
): Promise<Map<string, MemberCounts>> {
  if (!membershipIds.length) return new Map();
  const counts = new Map(membershipIds.map((id) => [id, { assignments: 0, reviewLinks: 0 }]));
  const [assignmentGroups, linkGroups] = await Promise.all([
    reader.assignment.groupBy({
      by: ["reviewerId"],
      where: { organizationId, reviewerId: { in: membershipIds } },
      _count: { _all: true },
    }),
    reader.reviewLink.groupBy({
      by: ["reviewerId"],
      where: { organizationId, reviewerId: { in: membershipIds } },
      _count: { _all: true },
    }),
  ]);
  for (const group of assignmentGroups) {
    const current = counts.get(group.reviewerId);
    if (current) current.assignments = group._count._all;
  }
  for (const group of linkGroups) {
    const current = counts.get(group.reviewerId);
    if (current) current.reviewLinks = group._count._all;
  }
  return counts;
}
