import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { formDefinitionSchema } from "@reviewroom/contracts/forms";
import { prisma } from "../../db/client.js";
import { HttpError } from "../../http/errors.js";
import { publicReadRateLimit, publicSubmitRateLimit } from "../../http/rate-limits.js";
import { validateAnswers, validatePartialAnswers } from "./answer-validator.js";
import { allowsForm } from "../links/review-link-scope.js";
import { assertPublicReviewAccess } from "./public-review-access.js";

export const publicReviewRouter = Router();
const tokenSchema = z.string().min(40).max(100);
const submissionSchema = z.object({
  formId: z.string().uuid(),
  formVersionId: z.string().uuid(),
  targetId: z.string().uuid(),
  answers: z.record(z.string().uuid(), z.unknown()),
}).strict();
const draftSchema = submissionSchema;
const draftIdentitySchema = z.object({ targetId: z.string().uuid(), formVersionId: z.string().uuid() }).strict();
const draftLifetimeMs = 90 * 24 * 60 * 60 * 1000;

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
    await prisma.reviewDraft.deleteMany({ where: { organizationId: link.organizationId, reviewerId: link.reviewerId, updatedAt: { lt: new Date(Date.now() - draftLifetimeMs) } } });
    const assignments = await prisma.assignment.findMany({ where: { organizationId: link.organizationId, reviewerId: link.reviewerId, target: { status: "ACTIVE", archivedAt: null } }, include: { target: { select: { id: true, displayName: true } } }, orderBy: { target: { displayName: "asc" } }, take: 200 });
    const assignmentIds = assignments.map(({ id }) => id);
    const targetIds = assignments.map(({ targetId }) => targetId);
    const [submitted, drafts] = await Promise.all([
      targetIds.length ? prisma.submission.groupBy({ by: ["targetId"], where: { organizationId: link.organizationId, reviewerId: link.reviewerId, targetId: { in: targetIds }, archivedAt: null }, _count: { _all: true } }) : Promise.resolve([]),
      assignmentIds.length ? prisma.reviewDraft.findMany({ where: { organizationId: link.organizationId, reviewerId: link.reviewerId, assignmentId: { in: assignmentIds }, updatedAt: { gte: new Date(Date.now() - draftLifetimeMs) } }, select: { assignmentId: true } }) : Promise.resolve([]),
    ]);
    const completedTargets = new Set(submitted.map((row) => row.targetId));
    const draftedAssignments = new Set(drafts.map(({ assignmentId }) => assignmentId));
    const targets = assignments.map(({ id, target }) => ({ id: target.id, displayName: target.displayName, completed: completedTargets.has(target.id), hasDraft: draftedAssignments.has(id) }));
    const forms = await prisma.form.findMany({ where: { organizationId: link.organizationId, ...(link.formId ? { id: link.formId } : {}), status: "PUBLISHED", archivedAt: null, currentPublishedId: { not: null } }, select: { id: true, title: true, description: true, currentPublishedId: true }, orderBy: [{ title: "asc" }, { id: "asc" }], take: 100 });
    const versions = await prisma.formVersion.findMany({ where: { id: { in: forms.map((form) => form.currentPublishedId).filter((id): id is string => id !== null) }, publishedAt: { not: null } }, select: { id: true, definition: true } });
    const versionById = new Map(versions.map((version) => [version.id, version]));
    const theme = await prisma.organizationTheme.findUnique({ where: { organizationId: link.organizationId }, select: { accentColor: true, fontPreset: true, surfacePreset: true, formStyle: true } });
    response.json({ data: { reviewerName: link.reviewer.user.displayName, theme: theme ?? { accentColor: "#167354", fontPreset: "sans", surfacePreset: "mist", formStyle: "clean" }, targets, forms: forms.flatMap((form) => { const version = form.currentPublishedId ? versionById.get(form.currentPublishedId) : undefined; return version ? [{ id: form.id, title: form.title, description: form.description, versionId: version.id, definition: version.definition }] : []; }) } });
  } catch (error) { next(error); }
});

async function resolveDraftContext(token: string, input: z.infer<typeof draftSchema>) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const link = await prisma.reviewLink.findUnique({ where: { tokenHash }, include: { reviewer: true } });
  if (!link) throw new HttpError(404, "LINK_NOT_FOUND", "This review link is unavailable.");
  assertPublicReviewAccess({ organizationId: link.organizationId, reviewerOrganizationId: link.reviewer.organizationId, reviewerRole: link.reviewer.role, reviewerStatus: link.reviewer.status, revokedAt: link.revokedAt, expiresAt: link.expiresAt }, "read");
  if (!allowsForm(link.formId, input.formId)) throw new HttpError(404, "FORM_NOT_FOUND", "This form is not available through this review link.");
  const assignment = await prisma.assignment.findUnique({ where: { organizationId_targetId: { organizationId: link.organizationId, targetId: input.targetId } }, include: { target: true } });
  if (!assignment || assignment.reviewerId !== link.reviewerId || assignment.target.status !== "ACTIVE" || assignment.target.archivedAt) throw new HttpError(404, "TARGET_NOT_FOUND", "This person is not available through this review link.");
  const form = await prisma.form.findFirst({ where: { id: input.formId, organizationId: link.organizationId, status: "PUBLISHED", archivedAt: null, currentPublishedId: input.formVersionId } });
  if (!form) throw new HttpError(404, "FORM_NOT_FOUND", "This form is not available.");
  const version = await prisma.formVersion.findFirst({ where: { id: input.formVersionId, formId: form.id, publishedAt: { not: null } } });
  if (!version) throw new HttpError(404, "FORM_VERSION_NOT_FOUND", "This form version is not available.");
  return { link, assignment, version };
}

publicReviewRouter.get("/:token/drafts", publicReadRateLimit, async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const token = tokenSchema.parse(request.params.token);
    const identity = draftIdentitySchema.parse({ targetId: request.query.targetId, formVersionId: request.query.formVersionId });
    const formVersion = await prisma.formVersion.findUnique({ where: { id: identity.formVersionId }, select: { formId: true } });
    if (!formVersion) throw new HttpError(404, "FORM_VERSION_NOT_FOUND", "This form version is not available.");
    const { link, assignment } = await resolveDraftContext(token, { ...identity, formId: formVersion.formId, answers: {} });
    await prisma.reviewDraft.deleteMany({ where: { organizationId: link.organizationId, reviewerId: link.reviewerId, updatedAt: { lt: new Date(Date.now() - draftLifetimeMs) } } });
    const draft = await prisma.reviewDraft.findUnique({ where: { organizationId_reviewerId_assignmentId_formVersionId: { organizationId: link.organizationId, reviewerId: link.reviewerId, assignmentId: assignment.id, formVersionId: identity.formVersionId } }, select: { answers: true, updatedAt: true } });
    response.json({ data: draft ?? null });
  } catch (error) { next(error); }
});

publicReviewRouter.put("/:token/drafts", publicSubmitRateLimit, async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const token = tokenSchema.parse(request.params.token);
    const input = draftSchema.parse(request.body);
    const { link, assignment, version } = await resolveDraftContext(token, input);
    await prisma.reviewDraft.deleteMany({ where: { organizationId: link.organizationId, reviewerId: link.reviewerId, updatedAt: { lt: new Date(Date.now() - draftLifetimeMs) } } });
    const answers = validatePartialAnswers(formDefinitionSchema.parse(version.definition), input.answers);
    const draft = await prisma.reviewDraft.upsert({
      where: { organizationId_reviewerId_assignmentId_formVersionId: { organizationId: link.organizationId, reviewerId: link.reviewerId, assignmentId: assignment.id, formVersionId: version.id } },
      create: { organizationId: link.organizationId, reviewerId: link.reviewerId, assignmentId: assignment.id, formVersionId: version.id, answers },
      update: { answers }, select: { answers: true, updatedAt: true },
    });
    response.json({ data: draft });
  } catch (error) { next(error); }
});

publicReviewRouter.delete("/:token/drafts", publicSubmitRateLimit, async (request, response, next) => {
  try {
    const token = tokenSchema.parse(request.params.token);
    const identity = draftIdentitySchema.parse({ targetId: request.query.targetId, formVersionId: request.query.formVersionId });
    const formVersion = await prisma.formVersion.findUnique({ where: { id: identity.formVersionId }, select: { formId: true } });
    if (!formVersion) throw new HttpError(404, "FORM_VERSION_NOT_FOUND", "This form version is not available.");
    const { link, assignment } = await resolveDraftContext(token, { ...identity, formId: formVersion.formId, answers: {} });
    await prisma.reviewDraft.deleteMany({ where: { organizationId: link.organizationId, reviewerId: link.reviewerId, assignmentId: assignment.id, formVersionId: identity.formVersionId } });
    response.status(204).end();
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
        await transaction.reviewDraft.deleteMany({ where: { organizationId: link.organizationId, reviewerId: link.reviewerId, assignmentId: assignment.id, formVersionId: version.id } });
        return { ...prior, replay: true };
      }
      const submission = await transaction.submission.create({ data: {
        organizationId: link.organizationId, formId: form.id, formVersionId: version.id,
        targetId: assignment.targetId, reviewerId: link.reviewerId, idempotencyKey, payloadHash, answers,
      }, select: { id: true, submittedAt: true } });
      await transaction.auditEvent.create({ data: { organizationId: link.organizationId, action: "SUBMISSION_CREATED", entityType: "Submission", entityId: submission.id, metadata: { formId: form.id, targetId: assignment.targetId, reviewerId: link.reviewerId } } });
      await transaction.reviewDraft.deleteMany({ where: { organizationId: link.organizationId, reviewerId: link.reviewerId, assignmentId: assignment.id, formVersionId: version.id } });
      return { ...submission, replay: false };
    });
    response.status(result.replay ? 200 : 201).json({ data: { id: result.id, submittedAt: result.submittedAt, replay: result.replay } });
  } catch (error) { next(error); }
});
