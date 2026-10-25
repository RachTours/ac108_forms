import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { Prisma } from "../../generated/prisma/client.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { getReviewerSubmissionMetrics, getSubmissionCompletionPercent, getWorkspaceSubmissionGoal } from "./progress-metrics.js";

export const progressRouter = Router();
progressRouter.use(requireSession);

type ReviewerBoardQueryRow = { reviewerId: string; displayName: string; assigned: bigint; completed: bigint; submissionCount: bigint };

export function toReviewerBoardRow(row: ReviewerBoardQueryRow, submissionGoal: number, activeReviewerCount: number) {
  const submissionMetrics = getReviewerSubmissionMetrics(Number(row.submissionCount), submissionGoal, activeReviewerCount);
  return {
    reviewerId: row.reviewerId,
    displayName: row.displayName,
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
}) {
  const submissionCompletionPercent = getSubmissionCompletionPercent(input.responseCount, input.submissionGoal);
  const reviewerSubmissionMetrics = input.reviewerAudience
    ? getReviewerSubmissionMetrics(input.responseCount, input.submissionGoal, input.activeReviewerCount)
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
    const [rows, activeReviewerCount, config] = await Promise.all([
      prisma.$queryRaw<ReviewerBoardQueryRow[]>`
      SELECT m.id AS reviewerId, u.displayName AS displayName,
        COUNT(DISTINCT t.id) AS assigned,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN t.id END) AS completed,
        COALESCE(MAX(authored.submissionCount), 0) AS submissionCount
      FROM Membership m
      INNER JOIN User u ON u.id = m.userId AND u.status = 'ACTIVE'
      LEFT JOIN (
        SELECT organizationId, reviewerId, COUNT(*) AS submissionCount
        FROM Submission
        WHERE organizationId = ${auth.organizationId} AND archivedAt IS NULL
        GROUP BY organizationId, reviewerId
      ) authored ON authored.organizationId = m.organizationId AND authored.reviewerId = m.id
      LEFT JOIN Assignment a ON a.reviewerId = m.id AND a.organizationId = m.organizationId
      LEFT JOIN ReviewTarget t ON t.id = a.targetId AND t.organizationId = m.organizationId AND t.status = 'ACTIVE' AND t.archivedAt IS NULL
      LEFT JOIN Submission s ON s.targetId = t.id AND s.reviewerId = m.id AND s.organizationId = m.organizationId AND s.archivedAt IS NULL
      WHERE m.organizationId = ${auth.organizationId} AND m.role = 'REVIEWER' AND m.status = 'ACTIVE'
        AND (${!reviewerOnly} OR m.id = ${auth.membershipId})
      GROUP BY m.id, u.displayName
      `,
      prisma.membership.count({ where: { organizationId: auth.organizationId, role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } } }),
      prisma.progressConfig.findUnique({ where: { organizationId: auth.organizationId }, select: { submissionGoal: true } }),
    ]);
    const submissionGoal = getWorkspaceSubmissionGoal(config?.submissionGoal);
    response.json({ data: rows.map((row) => toReviewerBoardRow(row, submissionGoal, activeReviewerCount)) });
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
    const targetCount = config?.targetCount ?? organizationTargetCount;
    const submissionGoal = getWorkspaceSubmissionGoal(config?.submissionGoal);
    response.json({ data: toProgressSummaryResponse({
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
    }) });
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

