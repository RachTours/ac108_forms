import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { HttpError } from "../../http/errors.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { getWorkspaceSubmissionGoal } from "../progress/progress-metrics.js";
import { reviewerGroupNameSchema } from "@reviewroom/contracts";

export const reviewerGroupRouter = Router();
reviewerGroupRouter.use(requireSession);
const idSchema = z.string().uuid();
const nameSchema = reviewerGroupNameSchema;
function groupMutationError(error: unknown) {
  return error && typeof error === "object" && "code" in error && error.code === "P2002"
    ? new HttpError(409, "GROUP_NAME_EXISTS", "A group with this name already exists.") : error;
}

reviewerGroupRouter.get("/", requirePermission("members", "read"), async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const [groups, config, activeReviewerCount] = await Promise.all([
      prisma.reviewerGroup.findMany({ where: { organizationId }, select: { id: true, name: true, createdAt: true, updatedAt: true, members: { where: { role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } }, select: { id: true, submissionGoalOverride: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
      prisma.progressConfig.findUnique({ where: { organizationId }, select: { submissionGoal: true } }),
      prisma.membership.count({ where: { organizationId, role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } } }),
    ]);
    const reviewerIds = groups.flatMap((group) => group.members.map((member) => member.id));
    const counts = reviewerIds.length ? await prisma.submission.groupBy({ by: ["reviewerId"], where: { organizationId, reviewerId: { in: reviewerIds }, archivedAt: null }, _count: { _all: true } }) : [];
    const countByReviewer = new Map(counts.map((row) => [row.reviewerId, row._count._all]));
    const sharedGoal = getWorkspaceSubmissionGoal(config?.submissionGoal) / Math.max(1, activeReviewerCount);
    response.json({ data: groups.map((group) => ({
      id: group.id, name: group.name, createdAt: group.createdAt, updatedAt: group.updatedAt,
      memberCount: group.members.length,
      submissionCount: group.members.reduce((total, member) => total + (countByReviewer.get(member.id) ?? 0), 0),
      submissionGoal: group.members.reduce((total, member) => total + (member.submissionGoalOverride ?? sharedGoal), 0),
    })) });
  } catch (error) { next(groupMutationError(error)); }
});

reviewerGroupRouter.post("/", requirePermission("members", "create"), requireCsrf, async (request, response, next) => {
  try {
    const { name } = nameSchema.parse(request.body);
    const auth = request.auth!;
    const group = await prisma.$transaction(async (transaction) => {
      const created = await transaction.reviewerGroup.create({ data: { organizationId: auth.organizationId, name } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "REVIEWER_GROUP_CREATED", entityType: "ReviewerGroup", entityId: created.id } });
      return created;
    });
    response.status(201).json({ data: { id: group.id, name: group.name, memberCount: 0, submissionCount: 0, submissionGoal: 0 } });
  } catch (error) { next(groupMutationError(error)); }
});

reviewerGroupRouter.patch("/:groupId", requirePermission("members", "update"), requireCsrf, async (request, response, next) => {
  try {
    const id = idSchema.parse(request.params.groupId);
    const { name } = nameSchema.parse(request.body);
    const auth = request.auth!;
    const existing = await prisma.reviewerGroup.findFirst({ where: { id, organizationId: auth.organizationId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "GROUP_NOT_FOUND", "Reviewer group not found.");
    const group = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.reviewerGroup.update({ where: { id }, data: { name } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "REVIEWER_GROUP_RENAMED", entityType: "ReviewerGroup", entityId: id } });
      return saved;
    });
    response.json({ data: { id: group.id, name: group.name } });
  } catch (error) { next(groupMutationError(error)); }
});

reviewerGroupRouter.delete("/:groupId", requirePermission("members", "archive"), requireCsrf, async (request, response, next) => {
  try {
    const id = idSchema.parse(request.params.groupId);
    const auth = request.auth!;
    await prisma.$transaction(async (transaction) => {
      const group = await transaction.reviewerGroup.findFirst({ where: { id, organizationId: auth.organizationId }, select: { id: true } });
      if (!group) throw new HttpError(404, "GROUP_NOT_FOUND", "Reviewer group not found.");
      await transaction.membership.updateMany({ where: { organizationId: auth.organizationId, groupId: id }, data: { groupId: null } });
      await transaction.reviewerGroup.delete({ where: { id } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "REVIEWER_GROUP_DELETED", entityType: "ReviewerGroup", entityId: id } });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});

reviewerGroupRouter.get("/:groupId/submissions", requirePermission("members", "read"), async (request, response, next) => {
  try {
    const auth = request.auth!;
    const groupId = idSchema.parse(request.params.groupId);
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.limit);
    const cursor = request.query.cursor ? idSchema.parse(request.query.cursor) : undefined;
    const group = await prisma.reviewerGroup.findFirst({ where: { id: groupId, organizationId: auth.organizationId }, select: { id: true, name: true } });
    if (!group) throw new HttpError(404, "GROUP_NOT_FOUND", "Reviewer group not found.");
    const where = { organizationId: auth.organizationId, archivedAt: null, reviewer: { groupId, role: "REVIEWER" as const, status: "ACTIVE" as const, user: { status: "ACTIVE" as const } } };
    if (cursor && !await prisma.submission.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) throw new HttpError(400, "INVALID_CURSOR", "Refresh this group's submissions and try again.");
    const [rows, total] = await Promise.all([
      prisma.submission.findMany({ where, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: limit + 1, select: { id: true, submittedAt: true, reviewedAt: true, target: { select: { displayName: true } }, form: { select: { title: true } }, formVersion: { select: { version: true } }, reviewer: { select: { user: { select: { displayName: true } } } } } }),
      prisma.submission.count({ where }),
    ]);
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map((row) => ({ id: row.id, submittedAt: row.submittedAt, reviewedAt: row.reviewedAt, targetName: row.target.displayName, formTitle: row.form.title, formVersion: row.formVersion.version, reviewerName: row.reviewer.user.displayName }));
    response.json({ data: { group, total, submissions: data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null } });
  } catch (error) { next(error); }
});
