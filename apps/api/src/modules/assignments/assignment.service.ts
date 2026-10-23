import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../http/errors.js";

type AssignmentTransaction = Prisma.TransactionClient;

export async function lockAssignmentTarget(transaction: AssignmentTransaction, organizationId: string, targetId: string) {
  await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM ReviewTarget WHERE organizationId = ${organizationId} AND id = ${targetId} FOR UPDATE
  `;
}

export async function lockAssignmentReviewer(transaction: AssignmentTransaction, organizationId: string, reviewerId: string) {
  await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Membership WHERE organizationId = ${organizationId} AND id = ${reviewerId} FOR UPDATE
  `;
}

export type AssignmentListInput = {
  organizationId: string;
  reviewerId?: string;
  state: "all" | "assigned" | "unassigned";
  search: string;
  cursor?: string;
  limit: number;
};

function activeAssignmentWhere(organizationId: string) {
  return {
    organizationId,
    reviewer: { role: "REVIEWER" as const, status: "ACTIVE" as const, user: { status: "ACTIVE" as const } },
  };
}

export async function listAssignments(transaction: AssignmentTransaction, input: AssignmentListInput) {
  const activeAssignment = activeAssignmentWhere(input.organizationId);
  const targetWhere = {
    organizationId: input.organizationId,
    status: "ACTIVE" as const,
    archivedAt: null,
    ...(input.search ? { OR: [
      { displayName: { contains: input.search } },
      { email: { contains: input.search } },
    ] } : {}),
  };
  const reviewerWhere = input.reviewerId
    ? { assignments: { some: { ...activeAssignment, reviewerId: input.reviewerId } } }
    : {};
  const filteredTargetWhere = { AND: [targetWhere, reviewerWhere] };
  const stateWhere = input.state === "assigned"
    ? { assignments: { some: activeAssignment } }
    : input.state === "unassigned"
      ? { assignments: { none: activeAssignment } }
      : {};
  const [rows, total, assigned, unassigned] = await Promise.all([
    transaction.reviewTarget.findMany({
      where: { AND: [filteredTargetWhere, stateWhere] },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        displayName: true,
        email: true,
        assignments: {
          where: activeAssignment,
          take: 1,
          select: {
            id: true,
            reviewerId: true,
            updatedAt: true,
            reviewer: { select: { user: { select: { displayName: true, email: true } } } },
          },
        },
      },
    }),
    transaction.reviewTarget.count({ where: filteredTargetWhere }),
    transaction.reviewTarget.count({ where: { AND: [filteredTargetWhere, { assignments: { some: activeAssignment } }] } }),
    transaction.reviewTarget.count({ where: { AND: [filteredTargetWhere, { assignments: { none: { organizationId: input.organizationId } } }] } }),
  ]);
  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  return {
    rows: page.map(({ assignments, ...target }) => {
      const current = assignments[0];
      return {
        ...target,
        assignment: current ? {
          id: current.id,
          reviewerId: current.reviewerId,
          updatedAt: current.updatedAt,
          reviewer: current.reviewer.user,
        } : null,
      };
    }),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    counts: { total, assigned, unassigned },
  };
}

export async function setAssignment(
  transaction: AssignmentTransaction,
  input: { organizationId: string; actorId: string; targetId: string; reviewerId: string; expectedUpdatedAt: Date | null; source?: string },
) {
  // Lifecycle changes lock the same records. Lock target then reviewer before
  // reading either state so concurrent archive/promote operations serialize.
  await lockAssignmentTarget(transaction, input.organizationId, input.targetId);
  await lockAssignmentReviewer(transaction, input.organizationId, input.reviewerId);
  const [target, reviewer] = await Promise.all([
    transaction.reviewTarget.findFirst({ where: { id: input.targetId, organizationId: input.organizationId, status: "ACTIVE", archivedAt: null }, select: { id: true } }),
    transaction.membership.findFirst({ where: { id: input.reviewerId, organizationId: input.organizationId, role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } }, select: { id: true } }),
  ]);
  if (!target) throw new HttpError(404, "TARGET_NOT_FOUND", "Active review target not found.");
  if (!reviewer) throw new HttpError(404, "REVIEWER_NOT_FOUND", "Active reviewer not found.");

  const key = { organizationId_targetId: { organizationId: input.organizationId, targetId: input.targetId } };
  const current = await transaction.assignment.findUnique({ where: key });
  if (current?.reviewerId === reviewer.id) return { assignment: current, changed: false };
  const previousReviewerId = current?.reviewerId ?? null;
  const currentVersion = current ? current.updatedAt.getTime() : null;
  let writeVersion = input.expectedUpdatedAt;
  if (current && input.expectedUpdatedAt === null) {
    const currentReviewer = await transaction.membership.findFirst({
      where: { id: current.reviewerId, organizationId: input.organizationId, role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } },
      select: { id: true },
    });
    if (!currentReviewer) writeVersion = current.updatedAt;
  }
  const writeVersionTime = writeVersion?.getTime() ?? null;
  if (currentVersion !== writeVersionTime) {
    throw new HttpError(409, "ASSIGNMENT_CHANGED", "This assignment changed since you opened it. Refresh and try again.");
  }

  const now = new Date();
  let saved;
  if (!current) {
    try {
      saved = await transaction.assignment.create({ data: { organizationId: input.organizationId, targetId: input.targetId, reviewerId: reviewer.id, updatedAt: now } });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new HttpError(409, "ASSIGNMENT_CHANGED", "Another administrator assigned this target. Refresh and try again.");
      }
      throw error;
    }
  } else {
    const updated = await transaction.assignment.updateMany({
      where: { id: current.id, organizationId: input.organizationId, updatedAt: writeVersion! },
      data: { reviewerId: reviewer.id, updatedAt: now },
    });
    if (updated.count !== 1) throw new HttpError(409, "ASSIGNMENT_CHANGED", "Another administrator changed this assignment. Refresh and try again.");
    saved = await transaction.assignment.findUnique({ where: key });
    if (!saved) throw new HttpError(409, "ASSIGNMENT_CHANGED", "This assignment changed. Refresh and try again.");
  }

  await transaction.auditEvent.create({ data: {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: current ? "TARGET_REASSIGNED" : "TARGET_ASSIGNED",
    entityType: "Assignment",
    entityId: saved.id,
    metadata: { targetId: input.targetId, previousReviewerId, reviewerId: reviewer.id, source: input.source ?? "team-access" },
  } });
  return { assignment: saved, changed: true };
}

export async function removeAssignment(
  transaction: AssignmentTransaction,
  input: { organizationId: string; actorId: string; targetId: string; expectedUpdatedAt: Date | null; source?: string },
) {
  await lockAssignmentTarget(transaction, input.organizationId, input.targetId);
  const key = { organizationId_targetId: { organizationId: input.organizationId, targetId: input.targetId } };
  const current = await transaction.assignment.findUnique({ where: key });
  if (!current) return { removed: false };
  if (!input.expectedUpdatedAt || current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
    throw new HttpError(409, "ASSIGNMENT_CHANGED", "This assignment changed since you opened it. Refresh and try again.");
  }
  const removed = await transaction.assignment.deleteMany({ where: { id: current.id, organizationId: input.organizationId, updatedAt: input.expectedUpdatedAt } });
  if (removed.count !== 1) throw new HttpError(409, "ASSIGNMENT_CHANGED", "Another administrator changed this assignment. Refresh and try again.");
  await transaction.auditEvent.create({ data: {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "TARGET_UNASSIGNED",
    entityType: "Assignment",
    entityId: current.id,
    metadata: { targetId: input.targetId, previousReviewerId: current.reviewerId, source: input.source ?? "team-access" },
  } });
  return { removed: true };
}

export async function removeReviewerAssignments(
  transaction: AssignmentTransaction,
  input: { organizationId: string; reviewerId: string; actorId: string; reason: "reviewer-archived" | "reviewer-promoted" },
) {
  const assignments = await transaction.assignment.findMany({
    where: { organizationId: input.organizationId, reviewerId: input.reviewerId },
    select: { id: true, targetId: true, reviewerId: true },
  });
  if (!assignments.length) return 0;
  await transaction.assignment.deleteMany({ where: { organizationId: input.organizationId, reviewerId: input.reviewerId } });
  await transaction.auditEvent.createMany({ data: assignments.map((assignment) => ({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "TARGET_UNASSIGNED",
    entityType: "Assignment",
    entityId: assignment.id,
    metadata: { targetId: assignment.targetId, previousReviewerId: assignment.reviewerId, source: input.reason },
  })) });
  return assignments.length;
}

export async function removeTargetAssignment(
  transaction: AssignmentTransaction,
  input: { organizationId: string; targetId: string; actorId: string; reason: "target-archived" },
) {
  await lockAssignmentTarget(transaction, input.organizationId, input.targetId);
  const current = await transaction.assignment.findUnique({ where: { organizationId_targetId: { organizationId: input.organizationId, targetId: input.targetId } } });
  if (!current) return false;
  await transaction.assignment.delete({ where: { id: current.id } });
  await transaction.auditEvent.create({ data: {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "TARGET_UNASSIGNED",
    entityType: "Assignment",
    entityId: current.id,
    metadata: { targetId: current.targetId, previousReviewerId: current.reviewerId, source: input.reason },
  } });
  return true;
}
