import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../http/errors.js";
import { setAssignment } from "../assignments/assignment.service.js";

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

  const targetsById = new Set(targets.map((target) => target.id));
  const saved = [];
  for (const targetId of input.targetIds) {
    if (!targetsById.has(targetId)) throw new HttpError(404, "TARGET_NOT_FOUND", "One or more active review targets were not found.");
    const current = await transaction.assignment.findUnique({ where: { organizationId_targetId: { organizationId: input.organizationId, targetId } }, select: { updatedAt: true } });
    const result = await setAssignment(transaction, { organizationId: input.organizationId, actorId: input.actorId, targetId, reviewerId: reviewer.id, expectedUpdatedAt: current?.updatedAt ?? null, source: "bulk" });
    saved.push(result.assignment);
  }
  return saved;
}
