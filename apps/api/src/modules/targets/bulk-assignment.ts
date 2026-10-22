import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../http/errors.js";

export async function assignTargets(
  transaction: Prisma.TransactionClient,
  input: { organizationId: string; actorId: string; reviewerId: string; targetIds: string[] },
) {
  const [targets, reviewer] = await Promise.all([
    transaction.reviewTarget.findMany({
      where: { id: { in: input.targetIds }, organizationId: input.organizationId, status: "ACTIVE", archivedAt: null },
      select: { id: true },
    }),
    transaction.membership.findFirst({
      where: { id: input.reviewerId, organizationId: input.organizationId, role: "REVIEWER", status: "ACTIVE" },
      select: { id: true },
    }),
  ]);
  if (!reviewer) throw new HttpError(404, "REVIEWER_NOT_FOUND", "Active reviewer not found.");
  if (targets.length !== input.targetIds.length) throw new HttpError(404, "TARGET_NOT_FOUND", "One or more active review targets were not found.");

  const targetsById = new Map(targets.map((target) => [target.id, target]));
  const saved = await Promise.all(input.targetIds.map((targetId) => {
    if (!targetsById.has(targetId)) throw new HttpError(404, "TARGET_NOT_FOUND", "One or more active review targets were not found.");
    return transaction.assignment.upsert({
      where: { organizationId_targetId: { organizationId: input.organizationId, targetId } },
      create: { organizationId: input.organizationId, targetId, reviewerId: reviewer.id },
      update: { reviewerId: reviewer.id },
      select: { id: true, targetId: true, reviewerId: true },
    });
  }));
  await transaction.auditEvent.createMany({ data: saved.map((assignment) => ({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "TARGET_ASSIGNED",
    entityType: "Assignment",
    entityId: assignment.id,
    metadata: { targetId: assignment.targetId, reviewerId: reviewer.id, source: "bulk" },
  })) });
  return saved;
}
