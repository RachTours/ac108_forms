import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { Prisma } from "../../generated/prisma/client.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { getReviewerSubmissionMetrics, getSubmissionCompletionPercent, getWorkspaceSubmissionGoal } from "./progress-metrics.js";

import { currentGroupSubmissionWhere } from "../members/group-history.js";

export const progressRouter = Router();
progressRouter.use(requireSession);

type ReviewerBoardQueryRow = { reviewerId: string; displayName: string; assigned: bigint; completed: bigint; submissionCount: bigint; submissionGoalOverride?: number | null; groupId?: string | null };

export function toReviewerBoardRow(row: ReviewerBoardQueryRow, submissionGoal: number, activeReviewerCount: number) {
  const submissionMetrics = getReviewerSubmissionMetrics(Number(row.submissionCount), submissionGoal, activeReviewerCount, row.submissionGoalOverride);
  return {
    reviewerId: row.reviewerId,
    displayName: row.displayName,
    groupId: row.groupId ?? null,
    assigned: Number(row.assigned),
    completed: Number(row.completed),
    submissionCount: Number(row.submissionCount),
    reviewerSubmissionGoal: submissionMetrics.reviewerSubmissionGoal,
    submissionRatio: submissionMetrics.submissionRatio,
    submissionsRemaining: submissionMetrics.submissionsRemaining,
    submissionPercent: submissionMetrics.submissionPercent,
    submissionGoalMet: submissionMetrics.submissionGoalMet,
  };
}

export function toProgressSummaryResponse(input: {
  activeTargets: number;
  assignedTargets: number;
  completedTargets: number;
  responseCount: number;
  unassignedTargets: number;
  targetCount: number;
  completionRule: string;
  submissionGoal: number;
  activeReviewerCount: number;
  reviewerAudience: boolean;
  reviewerGoalOverride?: number | null;
}) {
  const submissionCompletionPercent = getSubmissionCompletionPercent(input.responseCount, input.submissionGoal);
  const reviewerSubmissionMetrics = input.reviewerAudience
    ? getReviewerSubmissionMetrics(input.responseCount, input.submissionGoal, input.activeReviewerCount, input.reviewerGoalOverride)
    : { reviewerSubmissionGoal: null, submissionRatio: null, submissionsRemaining: null, submissionPercent: 0, submissionGoalMet: false };
  return {
    activeTargets: input.activeTargets,
    assignedTargets: input.assignedTargets,
    completedTargets: input.completedTargets,
    responseCount: input.responseCount,
    unassignedTargets: input.unassignedTargets,
    targetCount: input.targetCount,
    completionRule: input.completionRule,
    completionPercent: submissionCompletionPercent,
    submissionGoal: input.submissionGoal,
    submissionCompletionPercent,
    activeReviewerCount: input.activeReviewerCount,
    reviewerSubmissionGoal: reviewerSubmissionMetrics.reviewerSubmissionGoal,
    reviewerSubmissionRatio: reviewerSubmissionMetrics.submissionRatio,
    reviewerSubmissionsRemaining: reviewerSubmissionMetrics.submissionsRemaining,
    reviewerSubmissionPercent: reviewerSubmissionMetrics.submissionPercent,
    reviewerSubmissionGoalMet: reviewerSubmissionMetrics.submissionGoalMet,
  };
}

progressRouter.get("/reviewer-board", async (request, response, next) => {
  try {
    const auth = request.auth!;
    const reviewerOnly = auth.role === "REVIEWER";
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: auth.organizationId }, select: { groupWorkflowsEnabled: true } });
    const groups = organization.groupWorkflowsEnabled ? await prisma.reviewerGroup.findMany({ where: { organizationId: auth.organizationId, archivedAt: null }, select: { id: true, submissionGoal: true, _count: { select: { members: { where: { role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } } } } } } }) : [];
    const byGroup = new Map(groups.map((group) => [group.id, group]));
    const [rows, activeReviewerCount, config] = await Promise.all([
      prisma.$queryRaw<ReviewerBoardQueryRow[]>`
      SELECT m.id AS reviewerId, u.displayName AS displayName, m.submissionGoalOverride, m.groupId,
        COUNT(DISTINCT t.id) AS assigned,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN t.id END) AS completed,
        (
          SELECT COUNT(*) FROM Submission authored
          WHERE authored.organizationId = m.organizationId
            AND authored.reviewerId = m.id
            AND authored.archivedAt IS NULL
        ) AS submissionCount
      FROM Membership m
      INNER JOIN User u ON u.id = m.userId AND u.status = 'ACTIVE'
      LEFT JOIN Assignment a ON a.reviewerId = m.id AND a.organizationId = m.organizationId
      LEFT JOIN ReviewTarget t ON t.id = a.targetId AND t.organizationId = m.organizationId AND t.status = 'ACTIVE' AND t.archivedAt IS NULL
      LEFT JOIN Submission s ON s.targetId = t.id AND s.reviewerId = m.id AND s.organizationId = m.organizationId AND s.archivedAt IS NULL
      WHERE m.organizationId = ${auth.organizationId} AND m.role = 'REVIEWER' AND m.status = 'ACTIVE'
        AND (${!reviewerOnly} OR m.id = ${auth.membershipId})
      GROUP BY m.id, u.displayName, m.submissionGoalOverride, m.groupId
      `,
      prisma.membership.count({ where: { organizationId: auth.organizationId, role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } } }),
      prisma.progressConfig.findUnique({ where: { organizationId: auth.organizationId }, select: { submissionGoal: true } }),
    ]);
    const submissionGoal = getWorkspaceSubmissionGoal(config?.submissionGoal);
    response.json({ data: rows.map((row) => {
      if (!organization.groupWorkflowsEnabled) return toReviewerBoardRow(row, submissionGoal, activeReviewerCount);
      const group = row.groupId ? byGroup.get(row.groupId) : undefined;
      return toReviewerBoardRow({ ...row, submissionGoalOverride: group?.submissionGoal ? row.submissionGoalOverride ?? null : null }, group?.submissionGoal ?? 0, group?.submissionGoal ? group._count.members : 0);
    }) });
  } catch (error) { next(error); }
});

progressRouter.get("/summary", async (request, response, next) => {
  try {
    const auth = request.auth!;
    const reviewerScope = auth.role === "REVIEWER" ? { reviewerId: auth.membershipId } : undefined;
    const organizationId = auth.organizationId;
    const reviewerCompletionScope = reviewerScope ? Prisma.sql`AND a.reviewerId = ${auth.membershipId}` : Prisma.empty;
    const [activeTargets, assignedTargets, completedRows, responseCount, unassignedTargets, config, organizationTargetCount, activeReviewerCount] = await Promise.all([
      prisma.reviewTarget.count({ where: { organizationId, status: "ACTIVE", archivedAt: null, ...(reviewerScope ? { assignments: { some: reviewerScope } } : {}) } }),
      prisma.assignment.count({ where: { organizationId, ...(reviewerScope ?? {}), reviewer: { role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } }, target: { status: "ACTIVE", archivedAt: null } } }),
      prisma.$queryRaw<Array<{ completed: bigint }>>`
        SELECT COUNT(DISTINCT a.targetId) AS completed
        FROM Assignment a
        INNER JOIN ReviewTarget t ON t.id = a.targetId AND t.organizationId = a.organizationId AND t.status = 'ACTIVE' AND t.archivedAt IS NULL
        INNER JOIN Membership m ON m.id = a.reviewerId AND m.organizationId = a.organizationId AND m.role = 'REVIEWER' AND m.status = 'ACTIVE'
        INNER JOIN User u ON u.id = m.userId AND u.status = 'ACTIVE'
        INNER JOIN Submission s ON s.targetId = t.id AND s.reviewerId = a.reviewerId AND s.organizationId = a.organizationId AND s.archivedAt IS NULL
        WHERE a.organizationId = ${organizationId} ${reviewerCompletionScope}
      `,
      prisma.submission.count({ where: { organizationId, archivedAt: null, ...(reviewerScope ?? {}) } }),
      auth.role === "REVIEWER" ? Promise.resolve(0) : prisma.reviewTarget.count({ where: { organizationId, status: "ACTIVE", archivedAt: null, assignments: { none: { organizationId, reviewer: { role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } } } } } }),
      prisma.progressConfig.findUnique({ where: { organizationId }, select: { completionRule: true, targetCount: true, submissionGoal: true, updatedAt: true } }),
      prisma.reviewTarget.count({ where: { organizationId, status: "ACTIVE", archivedAt: null } }),
      prisma.membership.count({ where: { organizationId, role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } } }),
    ]);
    const completedTargets = Number(completedRows[0]?.completed ?? 0n);
    const [organization, reviewerConfig, groupAggregate, groupResponseCount, legacySubmissionCount] = await Promise.all([
      prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { groupWorkflowsEnabled: true } }),
      reviewerScope ? prisma.membership.findFirst({
        where: { id: auth.membershipId, organizationId },
        select: {
          groupId: true, submissionGoalOverride: true,
          reviewerGroup: {
            select: {
              name: true, archivedAt: true, submissionGoal: true,
              _count: { select: { members: { where: { role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } } } } },
            },
          },
        },
      }) : Promise.resolve(null),
      prisma.reviewerGroup.aggregate({ where: { organizationId, archivedAt: null }, _sum: { submissionGoal: true } }),
      prisma.submission.count({ where: currentGroupSubmissionWhere(organizationId) }),
      prisma.submission.count({ where: { organizationId, archivedAt: null, groupId: null, ...(reviewerScope ?? {}) } }),
    ]);
    const targetCount = config?.targetCount ?? organizationTargetCount;
    const submissionGoal = getWorkspaceSubmissionGoal(config?.submissionGoal);
    const data = toProgressSummaryResponse({
      activeTargets,
      assignedTargets,
      completedTargets,
      responseCount,
      unassignedTargets,
      targetCount,
      completionRule: config?.completionRule ?? "ONE_RESPONSE",
      submissionGoal,
      activeReviewerCount,
      reviewerAudience: Boolean(reviewerScope),
      reviewerGoalOverride: reviewerConfig?.submissionGoalOverride ?? null,
    });
    const group = reviewerConfig?.reviewerGroup;
    const currentGroupCount = reviewerScope && reviewerConfig?.groupId && !group?.archivedAt ? responseCount : 0;
    const grouped = organization.groupWorkflowsEnabled;
    const reviewerMetrics = getReviewerSubmissionMetrics(currentGroupCount, group?.submissionGoal ?? 0, group?.submissionGoal && !group.archivedAt ? group._count.members : 0, group?.submissionGoal ? reviewerConfig?.submissionGoalOverride : null);
    response.json({ data: {
      ...data, groupWorkflowsEnabled: grouped, groupGoalTotal: groupAggregate._sum.submissionGoal ?? 0, groupSubmissionCount: groupResponseCount, legacySubmissionCount, lifetimeResponseCount: responseCount,
      ...(grouped && !reviewerScope ? { submissionGoal: groupAggregate._sum.submissionGoal ?? 0, submissionCompletionPercent: getSubmissionCompletionPercent(groupResponseCount, groupAggregate._sum.submissionGoal ?? 0) } : {}),
      ...(grouped && reviewerScope ? { responseCount: currentGroupCount, groupName: group?.name ?? null, reviewerSubmissionGoal: reviewerMetrics.reviewerSubmissionGoal, reviewerSubmissionRatio: reviewerMetrics.submissionRatio, reviewerSubmissionsRemaining: reviewerMetrics.submissionsRemaining, reviewerSubmissionPercent: reviewerMetrics.submissionPercent, reviewerSubmissionGoalMet: reviewerMetrics.submissionGoalMet } : {}),
    } });
  } catch (error) { next(error); }
});

export const progressConfigPatchSchema = z.object({
  targetCount: z.number().int().min(0).max(100_000).optional(),
  submissionGoal: z.number().int().min(1).max(100_000).optional(),
  completionRule: z.literal("ONE_RESPONSE"),
}).strict().refine((input) => input.targetCount !== undefined || input.submissionGoal !== undefined, {
  message: "At least one progress goal is required.",
});

type ProgressConfigPatch = z.infer<typeof progressConfigPatchSchema>;

export function buildProgressConfigUpdate(existing: { targetCount: number | null; submissionGoal: number | null } | null, input: ProgressConfigPatch) {
  return {
    targetCount: input.targetCount ?? existing?.targetCount ?? null,
    submissionGoal: input.submissionGoal ?? getWorkspaceSubmissionGoal(existing?.submissionGoal),
    completionRule: input.completionRule,
  };
}

progressRouter.patch("/config", requirePermission("settings", "manage"), requireCsrf, async (request, response, next) => {
  try {
    const input = progressConfigPatchSchema.parse(request.body);
    const auth = request.auth!;
    const config = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.progressConfig.findUnique({ where: { organizationId: auth.organizationId }, select: { targetCount: true, submissionGoal: true } });
      const update = buildProgressConfigUpdate(existing, input);
      const saved = await transaction.progressConfig.upsert({
        where: { organizationId: auth.organizationId },
        create: { organizationId: auth.organizationId, ...update },
        update,
      });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "PROGRESS_CONFIG_UPDATED", entityType: "ProgressConfig", entityId: saved.id, metadata: input } });
      return saved;
    });
    response.json({ data: { targetCount: config.targetCount, submissionGoal: config.submissionGoal, completionRule: config.completionRule } });
  } catch (error) { next(error); }
});

