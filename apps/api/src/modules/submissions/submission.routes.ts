import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { HttpError } from "../../http/errors.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requireRole } from "../../middleware/require-role.js";
import { getReviewedPersonName } from "./submission-display.js";
import { permanentlyDeleteSubmission, setSubmissionArchived } from "./submission-lifecycle.js";
import { requestedReviewerScope } from "./submission-scope.js";

export const submissionRouter = Router();
const idSchema = z.string().uuid();

submissionRouter.use(requireSession);
submissionRouter.get("/", async (request, response, next) => {
  try {
    const auth = request.auth!;
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.limit);
    const cursor = request.query.cursor ? idSchema.parse(request.query.cursor) : undefined;
    const reviewed = z.enum(["true", "false"]).optional().parse(request.query.reviewed);
    const requestedReviewerId = auth.role === "REVIEWER" ? undefined : request.query.reviewerId ? idSchema.parse(request.query.reviewerId) : undefined;
    if (requestedReviewerId) {
      const reviewer = await prisma.membership.findFirst({ where: { id: requestedReviewerId, organizationId: auth.organizationId, role: "REVIEWER", status: "ACTIVE" }, select: { id: true } });
      if (!reviewer) throw new HttpError(404, "REVIEWER_NOT_FOUND", "Active reviewer not found.");
    }
    const reviewerId = requestedReviewerScope(auth.role, auth.membershipId, requestedReviewerId);
    const rows = await prisma.submission.findMany({
      where: { organizationId: auth.organizationId, archivedAt: null, ...(reviewerId ? { reviewerId } : {}), ...(reviewed === undefined ? {} : { reviewedAt: reviewed === "true" ? { not: null } : null }) },
      include: { target: { select: { id: true, displayName: true } }, form: { select: { id: true, title: true } }, reviewer: { include: { user: { select: { displayName: true } } } }, formVersion: { select: { version: true, definition: true } } },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    response.json({ data: page.map(({ formVersion, answers, target, ...row }) => ({ ...row, target, formVersion: { version: formVersion.version }, reviewedPersonName: getReviewedPersonName(formVersion.definition, answers, target.displayName) })), nextCursor: hasMore ? page.at(-1)?.id ?? null : null });
  } catch (error) { next(error); }
});

submissionRouter.get("/archived", requireRole("OWNER", "ADMIN"), async (request, response, next) => {
  try {
    const auth = request.auth!;
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.limit);
    const cursor = request.query.cursor ? idSchema.parse(request.query.cursor) : undefined;
    const reviewerId = request.query.reviewerId ? idSchema.parse(request.query.reviewerId) : undefined;
    if (reviewerId) {
      const reviewer = await prisma.membership.findFirst({ where: { id: reviewerId, organizationId: auth.organizationId, role: "REVIEWER", status: "ACTIVE" }, select: { id: true } });
      if (!reviewer) throw new HttpError(404, "REVIEWER_NOT_FOUND", "Active reviewer not found.");
    }
    const rows = await prisma.submission.findMany({
      where: { organizationId: auth.organizationId, archivedAt: { not: null }, ...(reviewerId ? { reviewerId } : {}) },
      include: { target: { select: { id: true, displayName: true } }, form: { select: { id: true, title: true } }, reviewer: { include: { user: { select: { displayName: true } } } }, formVersion: { select: { version: true, definition: true } } },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    response.json({ data: page.map(({ formVersion, answers, target, ...row }) => ({ ...row, target, formVersion: { version: formVersion.version }, reviewedPersonName: getReviewedPersonName(formVersion.definition, answers, target.displayName) })), nextCursor: hasMore ? page.at(-1)?.id ?? null : null });
  } catch (error) { next(error); }
});

submissionRouter.get("/:submissionId", async (request, response, next) => {
  try {
    const auth = request.auth!;
    const submissionId = idSchema.parse(request.params.submissionId);
    const archivedQuery = z.enum(["true"]).optional().parse(request.query.archived) === "true";
    if (archivedQuery && auth.role === "REVIEWER") throw new HttpError(404, "SUBMISSION_NOT_FOUND", "Submission not found.");
    const includeArchived = archivedQuery;
    const submission = await prisma.submission.findFirst({ where: { id: submissionId, organizationId: auth.organizationId, archivedAt: includeArchived ? { not: null } : null, ...(auth.role === "REVIEWER" ? { reviewerId: auth.membershipId } : {}) }, include: { target: { select: { id: true, displayName: true } }, form: { select: { id: true, title: true } }, reviewer: { include: { user: { select: { displayName: true } } } }, formVersion: { select: { version: true, definition: true } } } });
    if (!submission) throw new HttpError(404, "SUBMISSION_NOT_FOUND", "Submission not found.");
    response.json({ data: { ...submission, reviewedPersonName: getReviewedPersonName(submission.formVersion.definition, submission.answers, submission.target.displayName) } });
  } catch (error) { next(error); }
});

submissionRouter.patch("/:submissionId/review", requireCsrf, async (request, response, next) => {
  try {
    const { reviewed } = z.object({ reviewed: z.boolean() }).strict().parse(request.body);
    const auth = request.auth!;
    const submissionId = idSchema.parse(request.params.submissionId);
    const updated = await prisma.$transaction(async (transaction) => {
      const current = await transaction.submission.findFirst({ where: { id: submissionId, organizationId: auth.organizationId, archivedAt: null, ...(auth.role === "REVIEWER" ? { reviewerId: auth.membershipId } : {}) } });
      if (!current) throw new HttpError(404, "SUBMISSION_NOT_FOUND", "Submission not found.");
      const saved = await transaction.submission.update({ where: { id: current.id }, data: { reviewedAt: reviewed ? new Date() : null } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: reviewed ? "SUBMISSION_REVIEWED" : "SUBMISSION_REOPENED", entityType: "Submission", entityId: saved.id } });
      return saved;
    });
    response.json({ data: updated });
  } catch (error) { next(error); }
});

submissionRouter.delete("/:submissionId", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const auth = request.auth!;
    const submissionId = idSchema.parse(request.params.submissionId);
    await prisma.$transaction(async (transaction) => {
      await setSubmissionArchived({
        findSubmission: async ({ organizationId, submissionId: id, state }) => transaction.submission.findFirst({ where: { id, organizationId, ...(state === "any" ? {} : { archivedAt: state === "active" ? null : { not: null } }) }, select: { id: true } }),
        updateArchivedAt: async (id, archivedAt) => { await transaction.submission.update({ where: { id }, data: { archivedAt } }); },
        deleteSubmission: async (id) => { await transaction.submission.delete({ where: { id } }); },
        writeAudit: async ({ organizationId, actorId, action, entityId }) => { await transaction.auditEvent.create({ data: { organizationId, actorId, action, entityType: "Submission", entityId } }); },
      }, { organizationId: auth.organizationId, actorId: auth.userId, submissionId, archived: true });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});

submissionRouter.post("/:submissionId/restore", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const auth = request.auth!;
    const submissionId = idSchema.parse(request.params.submissionId);
    await prisma.$transaction(async (transaction) => setSubmissionArchived({
      findSubmission: async ({ organizationId, submissionId: id, state }) => transaction.submission.findFirst({ where: { id, organizationId, ...(state === "any" ? {} : { archivedAt: state === "active" ? null : { not: null } }) }, select: { id: true } }),
      updateArchivedAt: async (id, archivedAt) => { await transaction.submission.update({ where: { id }, data: { archivedAt } }); },
      deleteSubmission: async (id) => { await transaction.submission.delete({ where: { id } }); },
      writeAudit: async ({ organizationId, actorId, action, entityId }) => { await transaction.auditEvent.create({ data: { organizationId, actorId, action, entityType: "Submission", entityId } }); },
    }, { organizationId: auth.organizationId, actorId: auth.userId, submissionId, archived: false }));
    response.status(204).end();
  } catch (error) { next(error); }
});

submissionRouter.delete("/:submissionId/permanent", requireRole("OWNER", "ADMIN"), requireCsrf, async (request, response, next) => {
  try {
    const auth = request.auth!;
    const submissionId = idSchema.parse(request.params.submissionId);
    await prisma.$transaction(async (transaction) => permanentlyDeleteSubmission({
      findSubmission: async ({ organizationId, submissionId: id }) => transaction.submission.findFirst({ where: { id, organizationId }, select: { id: true } }),
      updateArchivedAt: async (id, archivedAt) => { await transaction.submission.update({ where: { id }, data: { archivedAt } }); },
      deleteSubmission: async (id) => { await transaction.submission.delete({ where: { id } }); },
      writeAudit: async ({ organizationId, actorId, action, entityId }) => { await transaction.auditEvent.create({ data: { organizationId, actorId, action, entityType: "Submission", entityId } }); },
    }, { organizationId: auth.organizationId, actorId: auth.userId, submissionId }));
    response.status(204).end();
  } catch (error) { next(error); }
});
