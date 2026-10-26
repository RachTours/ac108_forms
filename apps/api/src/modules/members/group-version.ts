import { Prisma } from "../../generated/prisma/client.js";
/** All callers hold the organization lock before changing group membership/settings. */
export async function bumpGroupVersions(transaction: Prisma.TransactionClient, organizationId: string, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return;
  await transaction.$executeRaw`UPDATE ReviewerGroup SET updatedAt = GREATEST(CURRENT_TIMESTAMP(3), DATE_ADD(updatedAt, INTERVAL 1000 MICROSECOND)) WHERE organizationId = ${organizationId} AND id IN (${Prisma.join(unique)})`;
}
