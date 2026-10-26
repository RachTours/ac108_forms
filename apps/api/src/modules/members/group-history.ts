import type { Prisma } from "../../generated/prisma/client.js";

/** Active group reports follow current members; stored submission attribution is audit history. */
export function currentGroupSubmissionWhere(organizationId: string, groupId?: string): Prisma.SubmissionWhereInput {
  return {
    organizationId, archivedAt: null,
    reviewer: {
      organizationId, groupId: groupId ?? { not: null }, role: "REVIEWER", status: "ACTIVE",
      user: { status: "ACTIVE" }, reviewerGroup: { organizationId, archivedAt: null },
    },
  };
}
