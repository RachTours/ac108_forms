import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { HttpError } from "../../http/errors.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { lockAssignmentOrganization } from "../assignments/assignment.service.js";
import { reviewerGroupWriteSchema } from "@reviewroom/contracts";

import { currentGroupSubmissionWhere } from "./group-history.js";
import { bumpGroupVersions } from "./group-version.js";
import { getReviewedPersonName } from "../submissions/submission-display.js";

export const reviewerGroupRouter = Router();
reviewerGroupRouter.use(requireSession);
const idSchema = z.string().uuid();
const groupInput = reviewerGroupWriteSchema;
const activeReviewers = { role: "REVIEWER" as const, status: "ACTIVE" as const, user: { status: "ACTIVE" as const } };
function mutationError(error: unknown) {
  return error && typeof error === "object" && "code" in error && error.code === "P2002" ? new HttpError(409, "GROUP_NAME_EXISTS", "A group with this name already exists.") : error;
}

reviewerGroupRouter.get("/config", requirePermission("members", "read"), async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const [organization, aggregate, legacySubmissions, ungroupedReviewers, unconfiguredGroups] = await Promise.all([
      prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { groupWorkflowsEnabled: true } }),
      prisma.reviewerGroup.aggregate({ where: { organizationId, archivedAt: null }, _sum: { submissionGoal: true } }),
      prisma.submission.count({ where: { organizationId, groupId: null, archivedAt: null } }),
      prisma.membership.count({ where: { organizationId, ...activeReviewers, groupId: null } }),
      prisma.reviewerGroup.count({ where: { organizationId, archivedAt: null, submissionGoal: null } }),
    ]);
    response.json({ data: { enabled: organization.groupWorkflowsEnabled, groupGoalTotal: aggregate._sum.submissionGoal ?? 0, legacySubmissions, ungroupedReviewers, unconfiguredGroups } });
  } catch (error) { next(error); }
});
reviewerGroupRouter.post("/config", requirePermission("settings", "manage"), requireCsrf, async (request, response, next) => {
  try {
    const input = z.object({ enabled: z.boolean(), confirmed: z.literal(true) }).strict().parse(request.body);
    const auth = request.auth!;
    await prisma.$transaction(async (transaction) => {
      await lockAssignmentOrganization(transaction, auth.organizationId);
      if (input.enabled) {
        const missingGoals = await transaction.reviewerGroup.count({ where: { organizationId: auth.organizationId, archivedAt: null, submissionGoal: null } });
        const missingGroups = await transaction.membership.count({ where: { organizationId: auth.organizationId, ...activeReviewers, OR: [{ groupId: null }, { reviewerGroup: { archivedAt: { not: null } } }] } });
        if (missingGoals || missingGroups) throw new HttpError(409, "GROUP_SETUP_INCOMPLETE", "Set every group goal and assign active reviewers to groups before activation.");
      }
      await transaction.organization.update({ where: { id: auth.organizationId }, data: { groupWorkflowsEnabled: input.enabled } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: input.enabled ? "GROUP_WORKFLOWS_ENABLED" : "GROUP_WORKFLOWS_DISABLED", entityType: "Organization", entityId: auth.organizationId } });
    });
    response.json({ data: { enabled: input.enabled } });
  } catch (error) { next(error); }
});
reviewerGroupRouter.get("/", requirePermission("members", "read"), async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const state = z.enum(["active", "archived"]).default("active").parse(request.query.state);
    const [groups, counts] = await Promise.all([
      prisma.reviewerGroup.findMany({ where: { organizationId, archivedAt: state === "active" ? null : { not: null } }, select: { id: true, name: true, submissionGoal: true, archivedAt: true, createdAt: true, updatedAt: true, members: { where: activeReviewers, select: { id: true } }, forms: { select: { formId: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
      state === "active"
        ? prisma.submission.groupBy({ by: ["reviewerId"], where: currentGroupSubmissionWhere(organizationId), _count: { _all: true } }).then((rows) => new Map(rows.map((row) => [row.reviewerId, row._count._all])))
        : prisma.submission.groupBy({ by: ["groupId"], where: { organizationId, groupId: { not: null }, archivedAt: null }, _count: { _all: true } }).then((rows) => new Map(rows.map((row) => [row.groupId!, row._count._all]))),
    ]);
    response.json({ data: groups.map(({ members, forms, ...group }) => ({ ...group, memberCount: members.length, submissionCount: state === "active" ? members.reduce((sum, member) => sum + (counts.get(member.id) ?? 0), 0) : counts.get(group.id) ?? 0, formIds: forms.map((form) => form.formId) })) });
  } catch (error) { next(error); }
});
reviewerGroupRouter.post("/", requirePermission("members", "create"), requireCsrf, async (request, response, next) => {
  try {
    const input = groupInput.parse(request.body);
    if (!input.name) throw new HttpError(400, "VALIDATION_ERROR", "A group name is required.");
    const auth = request.auth!;
    const group = await prisma.$transaction(async (transaction) => {
      await lockAssignmentOrganization(transaction, auth.organizationId);
      const created = await transaction.reviewerGroup.create({ data: { organizationId: auth.organizationId, name: input.name!, submissionGoal: input.submissionGoal ?? null } });
      if (input.formIds?.length) {
        const formIds = [...new Set(input.formIds)];
        const count = await transaction.form.count({ where: { organizationId: auth.organizationId, id: { in: formIds }, status: "PUBLISHED", archivedAt: null } });
        if (count !== formIds.length) throw new HttpError(400, "FORM_ASSIGNMENT_INVALID", "Choose published forms in this workspace.");
        await transaction.reviewerGroupFormGrant.createMany({ data: formIds.map((formId) => ({ organizationId: auth.organizationId, groupId: created.id, formId })) });
      }
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "REVIEWER_GROUP_CREATED", entityType: "ReviewerGroup", entityId: created.id } });
      return created;
    });
    response.status(201).json({ data: { ...group, memberCount: 0, submissionCount: 0, formIds: input.formIds ?? [] } });
  } catch (error) { next(mutationError(error)); }
});
reviewerGroupRouter.patch("/:groupId", requirePermission("members", "update"), requireCsrf, async (request, response, next) => {
  try {
    const id = idSchema.parse(request.params.groupId), input = groupInput.parse(request.body), auth = request.auth!;
    const group = await prisma.$transaction(async (transaction) => {
      await lockAssignmentOrganization(transaction, auth.organizationId);
      const current = await transaction.reviewerGroup.findFirst({ where: { id, organizationId: auth.organizationId, archivedAt: null } });
      if (!current) throw new HttpError(404, "GROUP_NOT_FOUND", "Active reviewer group not found.");
      if (input.expectedUpdatedAt && current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) throw new HttpError(409, "GROUP_CHANGED", "This group changed. Refresh before saving.");
      if (input.reviewerIds) {
        const ids = [...new Set(input.reviewerIds)];
        const count = await transaction.membership.count({ where: { organizationId: auth.organizationId, id: { in: ids }, ...activeReviewers } });
        if (count !== ids.length) throw new HttpError(400, "REVIEWER_NOT_FOUND", "Choose active reviewers from this workspace.");
        if (input.reviewerGoals?.some((row) => !ids.includes(row.reviewerId))) throw new HttpError(400, "REVIEWER_SETTINGS_ONLY", "Reviewer goals must belong to selected group members.");
        const moved = await transaction.membership.findMany({ where: { organizationId: auth.organizationId, id: { in: ids } }, select: { groupId: true } });
        await bumpGroupVersions(transaction, auth.organizationId, moved.map((member) => member.groupId).filter((groupId) => groupId !== id));
        await transaction.membership.updateMany({ where: { organizationId: auth.organizationId, groupId: id, id: { notIn: ids } }, data: { groupId: null } });
        await transaction.membership.updateMany({ where: { organizationId: auth.organizationId, id: { in: ids } }, data: { groupId: id } });
        for (const row of input.reviewerGoals ?? []) await transaction.membership.updateMany({ where: { organizationId: auth.organizationId, id: row.reviewerId, groupId: id }, data: { submissionGoalOverride: row.goal } });
      } else if (input.reviewerGoals) throw new HttpError(400, "REVIEWER_SETTINGS_ONLY", "Select group members when editing their goals.");
      if (input.formIds) {
        const formIds = [...new Set(input.formIds)];
        const count = await transaction.form.count({ where: { organizationId: auth.organizationId, id: { in: formIds }, status: "PUBLISHED", archivedAt: null } });
        if (count !== formIds.length) throw new HttpError(400, "FORM_ASSIGNMENT_INVALID", "Choose published forms in this workspace.");
        await transaction.reviewerGroupFormGrant.deleteMany({ where: { organizationId: auth.organizationId, groupId: id } });
        if (formIds.length) await transaction.reviewerGroupFormGrant.createMany({ data: formIds.map((formId) => ({ organizationId: auth.organizationId, groupId: id, formId })) });
      }
      const saved = await transaction.reviewerGroup.update({ where: { id }, data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.submissionGoal !== undefined ? { submissionGoal: input.submissionGoal } : {}), updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "REVIEWER_GROUP_UPDATED", entityType: "ReviewerGroup", entityId: id, metadata: { name: saved.name, submissionGoal: saved.submissionGoal, formsChanged: input.formIds !== undefined } } });
      return saved;
    });
    response.json({ data: group });
  } catch (error) { next(mutationError(error)); }
});
reviewerGroupRouter.put("/:groupId/members", requirePermission("members", "update"), requireCsrf, async (request, response, next) => {
  try {
    const id = idSchema.parse(request.params.groupId), auth = request.auth!;
    const input = z.object({ reviewerIds: z.array(idSchema).max(200), expectedUpdatedAt: z.iso.datetime({ offset: true }) }).strict().parse(request.body);
    const ids = [...new Set(input.reviewerIds)];
    await prisma.$transaction(async (transaction) => {
      await lockAssignmentOrganization(transaction, auth.organizationId);
      const group = await transaction.reviewerGroup.findFirst({ where: { id, organizationId: auth.organizationId, archivedAt: null } });
      if (!group) throw new HttpError(404, "GROUP_NOT_FOUND", "Active reviewer group not found.");
      if (group.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) throw new HttpError(409, "GROUP_CHANGED", "This group changed. Refresh before saving.");
      const count = await transaction.membership.count({ where: { organizationId: auth.organizationId, id: { in: ids }, ...activeReviewers } });
      if (count !== ids.length) throw new HttpError(400, "REVIEWER_NOT_FOUND", "Choose active reviewers from this workspace.");
      const moved = await transaction.membership.findMany({ where: { organizationId: auth.organizationId, id: { in: ids } }, select: { groupId: true } });
      await bumpGroupVersions(transaction, auth.organizationId, moved.map((member) => member.groupId).filter((groupId) => groupId !== id));
      await transaction.membership.updateMany({ where: { organizationId: auth.organizationId, groupId: id, id: { notIn: ids } }, data: { groupId: null } });
      await transaction.membership.updateMany({ where: { organizationId: auth.organizationId, id: { in: ids } }, data: { groupId: id } });
      await transaction.reviewerGroup.update({ where: { id }, data: { updatedAt: new Date(Math.max(Date.now(), group.updatedAt.getTime() + 1)) } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "GROUP_MEMBERS_UPDATED", entityType: "ReviewerGroup", entityId: id, metadata: { reviewerIds: ids } } });
    });
    response.json({ data: { saved: true } });
  } catch (error) { next(error); }
});
reviewerGroupRouter.delete("/:groupId", requirePermission("members", "archive"), requireCsrf, async (request, response, next) => {
  try {
    const id = idSchema.parse(request.params.groupId), auth = request.auth!;
    await prisma.$transaction(async (transaction) => {
      await lockAssignmentOrganization(transaction, auth.organizationId);
      const group = await transaction.reviewerGroup.findFirst({ where: { id, organizationId: auth.organizationId } });
      if (!group) throw new HttpError(404, "GROUP_NOT_FOUND", "Reviewer group not found.");
      await transaction.membership.updateMany({ where: { organizationId: auth.organizationId, groupId: id }, data: { groupId: null } });
      await transaction.reviewerGroup.update({ where: { id }, data: { archivedAt: new Date() } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "REVIEWER_GROUP_ARCHIVED", entityType: "ReviewerGroup", entityId: id } });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});
reviewerGroupRouter.get("/:groupId/submissions", requirePermission("members", "read"), async (request, response, next) => {
  try {
    const auth = request.auth!, groupId = idSchema.parse(request.params.groupId);
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.limit);
    const cursor = request.query.cursor ? idSchema.parse(request.query.cursor) : undefined;
    const sort = z.enum(["date", "member"]).default("date").parse(request.query.sort);
    const group = await prisma.reviewerGroup.findFirst({ where: { id: groupId, organizationId: auth.organizationId }, select: { id: true, name: true, archivedAt: true } });
    if (!group) throw new HttpError(404, "GROUP_NOT_FOUND", "Reviewer group not found.");
    const where = group.archivedAt ? { organizationId: auth.organizationId, groupId, archivedAt: null } : currentGroupSubmissionWhere(auth.organizationId, groupId);
    if (cursor && !await prisma.submission.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) throw new HttpError(400, "INVALID_CURSOR", "Refresh this list.");
    const [rows, total] = await Promise.all([
      prisma.submission.findMany({ where, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: sort === "member" ? [{ reviewer: { user: { displayName: "asc" } } }, { reviewerId: "asc" }, { submittedAt: "desc" }, { id: "desc" }] : [{ submittedAt: "desc" }, { id: "desc" }], take: limit + 1, select: { id: true, submittedAt: true, reviewedAt: true, answers: true, target: { select: { displayName: true } }, form: { select: { title: true } }, formVersion: { select: { version: true, definition: true } }, reviewer: { select: { user: { select: { displayName: true } } } } } }),
      prisma.submission.count({ where }),
    ]);
    const data = rows.slice(0, limit).map((row) => ({ id: row.id, submittedAt: row.submittedAt, reviewedAt: row.reviewedAt, targetName: row.target.displayName, reviewedPersonName: getReviewedPersonName(row.formVersion.definition, row.answers, row.target.displayName), formTitle: row.form.title, formVersion: row.formVersion.version, reviewerName: row.reviewer.user.displayName }));
    response.json({ data: { group, total, submissions: data, nextCursor: rows.length > limit ? data.at(-1)?.id ?? null : null } });
  } catch (error) { next(error); }
});
