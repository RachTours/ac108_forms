import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/client.js";
import { HttpError } from "../../http/errors.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requireRole } from "../../middleware/require-role.js";
import { assignTargets } from "./bulk-assignment.js";
import { createTargetSchema, idSchema, updateTargetSchema } from "./target.schemas.js";
import { autoAssignUnassignedTargets, listAssignments, lockAssignmentTarget, removeAssignment, removeTargetAssignment, setAssignment } from "../assignments/assignment.service.js";

export const targetRouter = Router();
const bulkAssignmentSchema = z.object({ targetIds: z.array(idSchema).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "Target IDs must be unique."), reviewerId: idSchema }).strict();

targetRouter.use(requireSession);
targetRouter.get("/assignment-options", requireRole("OWNER", "ADMIN"), async (request, response, next) => {
  try {
    const auth = request.auth!;
    const limit = z.coerce.number().int().min(1).max(100).default(100).parse(request.query.limit);
    const cursor = request.query.cursor ? idSchema.parse(request.query.cursor) : undefined;
    const search = z.string().trim().max(120).default("").parse(request.query.search ?? "");
    const result = await listAssignments(prisma, { organizationId: auth.organizationId, state: "all", search, limit, ...(cursor ? { cursor } : {}) });
    response.json({ data: result.rows.map(({ assignment, ...target }) => ({ ...target, assignedReviewer: assignment ? { membershipId: assignment.reviewerId, ...assignment.reviewer } : null })), nextCursor: result.nextCursor });
  } catch (error) { next(error); }
});

targetRouter.get("/", requireRole("OWNER", "ADMIN"), async (request, response, next) => {
  try {
    const auth = request.auth!;
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.limit);
    const cursor = request.query.cursor ? idSchema.parse(request.query.cursor) : undefined;
    const search = z.string().trim().max(120).default("").parse(request.query.search ?? "");
    const where = { organizationId: auth.organizationId, status: "ACTIVE" as const, archivedAt: null, displayName: { contains: search } };
    const rows = await prisma.reviewTarget.findMany({ where, orderBy: [{ displayName: "asc" }, { id: "asc" }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, displayName: true, email: true, createdAt: true, updatedAt: true } });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const responseCounts = page.length ? await prisma.$queryRaw<Array<{ targetId: string; submissionCount: bigint }>>`
      SELECT targetId, COUNT(*) AS submissionCount
      FROM Submission
      WHERE organizationId = ${auth.organizationId} AND archivedAt IS NULL
        AND targetId IN (${Prisma.join(page.map((target) => target.id))})
      GROUP BY targetId
    ` : [];
    const countByTarget = new Map(responseCounts.map((item) => [item.targetId, Number(item.submissionCount)]));
    response.json({ data: page.map((target) => ({ ...target, submissionCount: countByTarget.get(target.id) ?? 0 })), nextCursor: hasMore ? page.at(-1)?.id ?? null : null });
  } catch (error) { next(error); }
});

targetRouter.post("/", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const input = createTargetSchema.parse(request.body);
    const auth = request.auth!;
    const target = await prisma.$transaction(async (transaction) => {
      const created = await transaction.reviewTarget.create({ data: { organizationId: auth.organizationId, displayName: input.displayName, email: input.email || null } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "TARGET_CREATED", entityType: "ReviewTarget", entityId: created.id } });
      const assignments = await autoAssignUnassignedTargets(transaction, { organizationId: auth.organizationId, actorId: auth.userId, source: "auto-balance-new-target", targetIds: [created.id] });
      const assignment = assignments.find(({ targetId }) => targetId === created.id);
      const reviewer = assignment
        ? await transaction.membership.findFirst({ where: { id: assignment.reviewerId, organizationId: auth.organizationId }, select: { id: true, user: { select: { displayName: true, email: true } } } })
        : null;
      return { ...created, assignedReviewer: reviewer ? { membershipId: reviewer.id, ...reviewer.user } : null, submissionCount: 0 };
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
      await lockAssignmentTarget(transaction, auth.organizationId, targetId);
      const target = await transaction.reviewTarget.findFirst({ where: { id: targetId, organizationId: auth.organizationId, archivedAt: null } });
      if (!target) throw new HttpError(404, "TARGET_NOT_FOUND", "Review target not found.");
      await removeTargetAssignment(transaction, { organizationId: auth.organizationId, targetId, actorId: auth.userId, reason: "target-archived" });
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
      const current = await transaction.assignment.findUnique({ where: { organizationId_targetId: { organizationId: auth.organizationId, targetId } }, select: { updatedAt: true } });
      return (await setAssignment(transaction, { organizationId: auth.organizationId, actorId: auth.userId, targetId, reviewerId, expectedUpdatedAt: current?.updatedAt ?? null, source: "legacy-route" })).assignment;
    });
    response.json({ data: assignment });
  } catch (error) { next(error); }
});

targetRouter.delete("/:targetId/assignment", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const targetId = idSchema.parse(request.params.targetId);
    const auth = request.auth!;
    await prisma.$transaction(async (transaction) => {
      const assignment = await transaction.assignment.findUnique({ where: { organizationId_targetId: { organizationId: auth.organizationId, targetId } }, select: { updatedAt: true } });
      await removeAssignment(transaction, { organizationId: auth.organizationId, actorId: auth.userId, targetId, expectedUpdatedAt: assignment?.updatedAt ?? null, source: "legacy-route" });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});
