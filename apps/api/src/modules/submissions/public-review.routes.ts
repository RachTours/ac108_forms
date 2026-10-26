import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { formDefinitionSchema } from "@reviewroom/contracts/forms";
import { prisma } from "../../db/client.js";
import { HttpError } from "../../http/errors.js";
import { publicReadRateLimit, publicSubmitRateLimit } from "../../http/rate-limits.js";
import { validateAnswers } from "./answer-validator.js";
import { allowsForm } from "../links/review-link-scope.js";
import { assertPublicReviewAccess } from "./public-review-access.js";
import { assertReviewerFormAccess, reviewerFormScope } from "../members/reviewer-form-access.js";
import { resolvePlatformTheme } from "../organization/theme.js";

export const publicReviewRouter = Router();
const tokenSchema = z.string().min(40).max(100);
const submissionSchema = z.object({
  formId: z.string().uuid(),
  formVersionId: z.string().uuid(),
  targetId: z.string().uuid(),
  answers: z.record(z.string().uuid(), z.unknown()),
}).strict();

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

publicReviewRouter.get("/:token", publicReadRateLimit, async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const tokenHash = createHash("sha256").update(tokenSchema.parse(request.params.token)).digest("hex");
    const link = await prisma.reviewLink.findUnique({ where: { tokenHash }, include: { reviewer: { include: { user: { select: { displayName: true } } } } } });
    if (!link) throw new HttpError(404, "LINK_NOT_FOUND", "This review link is unavailable.");
    assertPublicReviewAccess({ organizationId: link.organizationId, reviewerOrganizationId: link.reviewer.organizationId, reviewerRole: link.reviewer.role, reviewerStatus: link.reviewer.status, revokedAt: link.revokedAt, expiresAt: link.expiresAt }, "read");
    const targets = await prisma.assignment.findMany({ where: { organizationId: link.organizationId, reviewerId: link.reviewerId, target: { status: "ACTIVE", archivedAt: null } }, include: { target: { select: { id: true, displayName: true } } }, orderBy: { target: { displayName: "asc" } }, take: 200 });
    const scope = await reviewerFormScope(prisma, link.organizationId, link.reviewerId);
    const forms = await prisma.form.findMany({ where: { organizationId: link.organizationId, ...(link.formId ? { id: link.formId } : {}), status: "PUBLISHED", archivedAt: null, currentPublishedId: { not: null }, ...scope }, select: { id: true, title: true, description: true, currentPublishedId: true }, orderBy: [{ title: "asc" }, { id: "asc" }], take: 100 });
    const versions = await prisma.formVersion.findMany({ where: { id: { in: forms.map((form) => form.currentPublishedId).filter((id): id is string => id !== null) }, publishedAt: { not: null } }, select: { id: true, definition: true } });
    const versionById = new Map(versions.map((version) => [version.id, version]));
    const appearance = await prisma.organizationTheme.findUnique({ where: { organizationId: link.organizationId } });
    const theme = resolvePlatformTheme(appearance, "reviewer");
    response.json({ data: { reviewerName: link.reviewer.user.displayName, theme: theme ?? { accentColor: "#167354", fontPreset: "sans", surfacePreset: "mist", formStyle: "clean" }, targets: targets.map(({ target }) => target), forms: forms.flatMap((form) => { const version = form.currentPublishedId ? versionById.get(form.currentPublishedId) : undefined; return version ? [{ id: form.id, title: form.title, description: form.description, versionId: version.id, definition: version.definition }] : []; }) } });
  } catch (error) { next(error); }
});

publicReviewRouter.post("/:token/submissions", publicSubmitRateLimit, async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const tokenHash = createHash("sha256").update(tokenSchema.parse(request.params.token)).digest("hex");
    const idempotencyKey = z.string().uuid().parse(request.get("idempotency-key"));
    const input = submissionSchema.parse(request.body);
    const result = await prisma.$transaction(async (transaction) => {
      const link = await transaction.reviewLink.findUnique({ where: { tokenHash }, include: { reviewer: true } });
      if (!link) throw new HttpError(404, "LINK_NOT_FOUND", "This review link is unavailable.");
      assertPublicReviewAccess({ organizationId: link.organizationId, reviewerOrganizationId: link.reviewer.organizationId, reviewerRole: link.reviewer.role, reviewerStatus: link.reviewer.status, revokedAt: link.revokedAt, expiresAt: link.expiresAt }, "submit");
      if (!allowsForm(link.formId, input.formId)) throw new HttpError(404, "FORM_NOT_FOUND", "This form is not available through this review link.");
      await assertReviewerFormAccess(transaction, link.organizationId, link.reviewerId, input.formId);
      const assignment = await transaction.assignment.findUnique({ where: { organizationId_targetId: { organizationId: link.organizationId, targetId: input.targetId } }, include: { target: true } });
      if (!assignment || assignment.reviewerId !== link.reviewerId || assignment.target.status !== "ACTIVE" || assignment.target.archivedAt) throw new HttpError(404, "TARGET_NOT_FOUND", "This person is not available through this review link.");
      const form = await transaction.form.findFirst({ where: { id: input.formId, organizationId: link.organizationId, status: "PUBLISHED", archivedAt: null, currentPublishedId: input.formVersionId } });
      if (!form) throw new HttpError(404, "FORM_NOT_FOUND", "This form is not available.");
      const version = await transaction.formVersion.findFirst({ where: { id: input.formVersionId, formId: form.id, publishedAt: { not: null } } });
      if (!version) throw new HttpError(404, "FORM_VERSION_NOT_FOUND", "This form version is not available.");
      const definition = formDefinitionSchema.parse(version.definition);
      const answers = validateAnswers(definition, input.answers);
      const payloadHash = createHash("sha256").update(canonicalJson({ ...input, answers })).digest("hex");
      const prior = await transaction.submission.findUnique({ where: { organizationId_idempotencyKey: { organizationId: link.organizationId, idempotencyKey } }, select: { id: true, payloadHash: true, submittedAt: true } });
      if (prior) {
        if (prior.payloadHash !== payloadHash) throw new HttpError(409, "IDEMPOTENCY_KEY_REUSED", "This request key was already used for a different response.");
        return { ...prior, replay: true };
      }
      const submission = await transaction.submission.create({ data: {
        organizationId: link.organizationId, formId: form.id, formVersionId: version.id,
        targetId: assignment.targetId, reviewerId: link.reviewerId, idempotencyKey, payloadHash, answers,
      }, select: { id: true, submittedAt: true } });
      await transaction.auditEvent.create({ data: { organizationId: link.organizationId, action: "SUBMISSION_CREATED", entityType: "Submission", entityId: submission.id, metadata: { formId: form.id, targetId: assignment.targetId, reviewerId: link.reviewerId } } });
      return { ...submission, replay: false };
    });
    response.status(result.replay ? 200 : 201).json({ data: { id: result.id, submittedAt: result.submittedAt, replay: result.replay } });
  } catch (error) { next(error); }
});
