import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { HttpError } from "../../http/errors.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requireRole } from "../../middleware/require-role.js";
import { assignTargets } from "./bulk-assignment.js";
import { createTargetSchema, idSchema, updateTargetSchema } from "./target.schemas.js";

export const targetRouter = Router();
const bulkAssignmentSchema = z.object({ targetIds: z.array(idSchema).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "Target IDs must be unique."), reviewerId: idSchema }).strict();

targetRouter.use(requireSession);
targetRouter.get("/", requireRole("OWNER", "ADMIN"), async (request, response, next) => {
  try {
    const auth = request.auth!;
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.limit);
    const cursor = request.query.cursor ? idSchema.parse(request.query.cursor) : undefined;
    const search = z.string().trim().max(120).default("").parse(request.query.search ?? "");
    const where = { organizationId: auth.organizationId, status: "ACTIVE" as const, archivedAt: null, displayName: { contains: search } };
    const rows = await prisma.reviewTarget.findMany({ where, orderBy: [{ displayName: "asc" }, { id: "asc" }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), include: { assignments: { include: { reviewer: { include: { user: { select: { displayName: true, email: true } } } } }, take: 1 } } });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const assignedPairs = page.flatMap((target) => target.assignments.map((assignment) => ({ targetId: target.id, reviewerId: assignment.reviewerId })));
    const responseCounts = assignedPairs.length ? await prisma.submission.groupBy({
      by: ["targetId", "reviewerId"],
      where: { organizationId: auth.organizationId, archivedAt: null, OR: assignedPairs },
      _count: { _all: true },
    }) : [];
    const countByPair = new Map(responseCounts.map((item) => [`${item.targetId}:${item.reviewerId}`, item._count._all]));
    response.json({ data: page.map(({ assignments, ...target }) => {
      const assigned = assignments[0];
      return { ...target, assignedReviewer: assigned ? { membershipId: assigned.reviewerId, displayName: assigned.reviewer.user.displayName, email: assigned.reviewer.user.email } : null, submissionCount: assigned ? countByPair.get(`${target.id}:${assigned.reviewerId}`) ?? 0 : 0 };
    }), nextCursor: hasMore ? page.at(-1)?.id ?? null : null });
  } catch (error) { next(error); }
});

targetRouter.post("/", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const input = createTargetSchema.parse(request.body);
    const auth = request.auth!;
    const target = await prisma.$transaction(async (transaction) => {
      const reviewer = input.reviewerId ? await transaction.membership.findFirst({ where: { id: input.reviewerId, organizationId: auth.organizationId, role: "REVIEWER", status: "ACTIVE" }, include: { user: { select: { displayName: true, email: true } } } }) : null;
      if (input.reviewerId && !reviewer) throw new HttpError(404, "REVIEWER_NOT_FOUND", "Active reviewer not found.");
      const created = await transaction.reviewTarget.create({ data: { organizationId: auth.organizationId, displayName: input.displayName, email: input.email || null } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "TARGET_CREATED", entityType: "ReviewTarget", entityId: created.id } });
      if (reviewer) {
        const assignment = await transaction.assignment.create({ data: { organizationId: auth.organizationId, targetId: created.id, reviewerId: reviewer.id } });
        await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "TARGET_ASSIGNED", entityType: "Assignment", entityId: assignment.id, metadata: { targetId: created.id, reviewerId: reviewer.id } } });
      }
      return { ...created, assignedReviewer: reviewer ? { membershipId: reviewer.id, displayName: reviewer.user.displayName, email: reviewer.user.email } : null, submissionCount: 0 };
    });
    response.status(201).json({ data: target });
  } catch (error) { next(error); }
});

targetRouter.patch("/:targetId", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const targetId = idSchema.parse(request.params.targetId);
    const input = updateTargetSchema.parse(request.body);
    const auth = request.auth!;
    const target = await prisma.$transaction(async (transaction) => {
      const current = await transaction.reviewTarget.findFirst({ where: { id: targetId, organizationId: auth.organizationId, archivedAt: null } });
      if (!current) throw new HttpError(404, "TARGET_NOT_FOUND", "Review target not found.");
      const updateData = { ...(input.displayName !== undefined ? { displayName: input.displayName } : {}), ...(input.email !== undefined ? { email: input.email === "" ? null : input.email } : {}) };
      const updated = await transaction.reviewTarget.update({ where: { id: current.id }, data: updateData });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "TARGET_UPDATED", entityType: "ReviewTarget", entityId: targetId } });
      return updated;
    });
    response.json({ data: target });
  } catch (error) { next(error); }
});

targetRouter.delete("/:targetId", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const targetId = idSchema.parse(request.params.targetId);
    const auth = request.auth!;
    await prisma.$transaction(async (transaction) => {
      const target = await transaction.reviewTarget.findFirst({ where: { id: targetId, organizationId: auth.organizationId, archivedAt: null } });
      if (!target) throw new HttpError(404, "TARGET_NOT_FOUND", "Review target not found.");
      await transaction.reviewTarget.update({ where: { id: targetId }, data: { status: "ARCHIVED", archivedAt: new Date() } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "TARGET_ARCHIVED", entityType: "ReviewTarget", entityId: targetId } });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});

targetRouter.post("/assignments/bulk", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const input = bulkAssignmentSchema.parse(request.body);
    const auth = request.auth!;
    const result = await prisma.$transaction((transaction) => assignTargets(transaction, { ...input, organizationId: auth.organizationId, actorId: auth.userId }));
    response.json({ data: result, assignedCount: result.length });
  } catch (error) { next(error); }
});

targetRouter.put("/:targetId/assignment", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const targetId = idSchema.parse(request.params.targetId);
    const { reviewerId } = z.object({ reviewerId: idSchema }).strict().parse(request.body);
    const auth = request.auth!;
    const assignment = await prisma.$transaction(async (transaction) => {
      const [target, reviewer] = await Promise.all([
        transaction.reviewTarget.findFirst({ where: { id: targetId, organizationId: auth.organizationId, status: "ACTIVE", archivedAt: null } }),
        transaction.membership.findFirst({ where: { id: reviewerId, organizationId: auth.organizationId, role: "REVIEWER", status: "ACTIVE" } }),
      ]);
      if (!target) throw new HttpError(404, "TARGET_NOT_FOUND", "Review target not found.");
      if (!reviewer) throw new HttpError(404, "REVIEWER_NOT_FOUND", "Active reviewer not found.");
      const saved = await transaction.assignment.upsert({ where: { organizationId_targetId: { organizationId: auth.organizationId, targetId } }, create: { organizationId: auth.organizationId, targetId, reviewerId }, update: { reviewerId } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "TARGET_ASSIGNED", entityType: "Assignment", entityId: saved.id, metadata: { targetId, reviewerId } } });
      return saved;
    });
    response.json({ data: assignment });
  } catch (error) { next(error); }
});

targetRouter.delete("/:targetId/assignment", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const targetId = idSchema.parse(request.params.targetId);
    const auth = request.auth!;
    await prisma.$transaction(async (transaction) => {
      const assignment = await transaction.assignment.findUnique({ where: { organizationId_targetId: { organizationId: auth.organizationId, targetId } } });
      if (!assignment) throw new HttpError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");
      await transaction.assignment.delete({ where: { id: assignment.id } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "TARGET_UNASSIGNED", entityType: "Assignment", entityId: assignment.id } });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});
