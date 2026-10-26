import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { assertReviewerFormAccess, reviewerFormScope } from "../members/reviewer-form-access.js";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { env } from "../../env.js";
import { HttpError } from "../../http/errors.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { lockAssignmentOrganization } from "../assignments/assignment.service.js";
import { authorize } from "@reviewroom/domain";
import { activeReviewerKey, calculateLinkExpiry } from "./review-link-scope.js";
import { decryptSecret, encryptSecret } from "../secrets/secret-box.js";
import { canReviewerRevealLink } from "./reviewer-reveal.js";

export const reviewLinkRouter = Router();
const idSchema = z.string().uuid();
const issueOptionsSchema = z.object({ expiresInDays: z.number().int().min(1).max(365).default(90) }).strict();

reviewLinkRouter.get("/mine", requireSession, requirePermission("reviewLinks", "readOwn"), async (request, response, next) => {
  try {
    const auth = request.auth!;
    const links = await prisma.reviewLink.findMany({ where: { organizationId: auth.organizationId, reviewerId: auth.membershipId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true, createdAt: true, expiresAt: true } });
    response.json({ data: links.map((link) => ({ ...link, active: true })) });
  } catch (error) { next(error); }
});

reviewLinkRouter.get("/mine/forms", requireSession, requirePermission("reviewLinks", "readOwn"), async (request, response, next) => {
  try {
    const auth = request.auth!;
    const scope = await reviewerFormScope(prisma, auth.organizationId, auth.membershipId);
    const legacy = await prisma.reviewLink.findMany({ where: { organizationId: auth.organizationId, reviewerId: auth.membershipId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { formId: true } });
    const preserveAllForms = legacy.some((link) => link.formId === null);
    const legacyFormIds = legacy.flatMap((link) => link.formId ? [link.formId] : []);
    const [forms, links] = await Promise.all([
      prisma.form.findMany({ where: { organizationId: auth.organizationId, status: "PUBLISHED", archivedAt: null, currentPublishedId: { not: null }, ...(preserveAllForms ? {} : { OR: [scope, { id: { in: legacyFormIds } }] }) }, select: { id: true, title: true, description: true }, orderBy: [{ title: "asc" }, { id: "asc" }], take: 100 }),
      prisma.reviewLink.findMany({ where: { organizationId: auth.organizationId, reviewerId: auth.membershipId, formId: { not: null } }, select: { id: true, formId: true, createdAt: true, expiresAt: true, revokedAt: true, encryptedToken: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    const creatableForms = await prisma.form.findMany({ where: { organizationId: auth.organizationId, status: "PUBLISHED", archivedAt: null, currentPublishedId: { not: null }, ...scope }, select: { id: true }, take: 100 });
    const creatable = new Set(creatableForms.map((form) => form.id));
    const currentByForm = new Map<string, (typeof links)[number]>();
    for (const link of links) if (link.formId && !currentByForm.has(link.formId)) currentByForm.set(link.formId, link);
    response.json({ data: forms.map((form) => {
      const link = currentByForm.get(form.id);
      const policy = request.baseUrl.startsWith("/api/v2/") ? { canGenerate: creatable.has(form.id) } : {};
      if (!link) return { ...form, ...policy, link: null };
      const { encryptedToken, ...safeLink } = link;
      return { ...form, ...policy, link: { ...safeLink, canReveal: encryptedToken !== null, active: link.revokedAt === null && (link.expiresAt === null || link.expiresAt > new Date()) } };
    }) });
  } catch (error) { next(error); }
});

reviewLinkRouter.get("/", requireSession, requirePermission("reviewLinks", "read"), async (request, response, next) => {
  try {
    const links = await prisma.reviewLink.findMany({
      where: { organizationId: request.auth!.organizationId },
      include: { reviewer: { include: { user: { select: { displayName: true, email: true } } } }, form: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" }, take: 200,
    });
    response.json({ data: links.map(({ tokenHash: _secret, encryptedToken, reviewer, groupId, accessPolicyVersion, ...link }) => ({ ...link, ...(request.originalUrl.startsWith("/api/v2/") ? { groupId, accessPolicyVersion } : {}), canReveal: encryptedToken !== null, reviewer: { id: reviewer.id, name: reviewer.user.displayName, email: reviewer.user.email }, active: link.revokedAt === null && (link.expiresAt === null || link.expiresAt > new Date()) })) });
  } catch (error) { next(error); }
});

async function issueLink(organizationId: string, actorId: string, reviewerId: string, formId: string | null = null, expiresInDays = 90) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = calculateLinkExpiry(expiresInDays);
  const link = await prisma.$transaction(async (transaction) => {
    await lockAssignmentOrganization(transaction, organizationId);
    const reviewer = await transaction.membership.findFirst({ where: { id: reviewerId, organizationId, role: "REVIEWER", status: "ACTIVE" }, include: { organization: { select: { groupWorkflowsEnabled: true } } } });
    if (!reviewer) throw new HttpError(404, "REVIEWER_NOT_FOUND", "Active reviewer not found.");
    if (reviewer.organization.groupWorkflowsEnabled && !formId) throw new HttpError(409, "GROUP_FORM_REQUIRED", "Choose one of your group's assigned forms to create a link.");
    if (formId) {
      await assertReviewerFormAccess(transaction, organizationId, reviewerId, formId);
      const form = await transaction.form.findFirst({ where: { id: formId, organizationId, status: "PUBLISHED", archivedAt: null, currentPublishedId: { not: null } }, select: { id: true } });
      if (!form) throw new HttpError(404, "FORM_NOT_FOUND", "Published form not found.");
    }
    await transaction.reviewLink.updateMany({ where: { organizationId, reviewerId, formId, revokedAt: null }, data: { revokedAt: new Date(), activeReviewerKey: null } });
    const created = await transaction.reviewLink.create({ data: { organizationId, reviewerId, formId, tokenHash, encryptedToken: encryptSecret(token, env.TOKEN_ENCRYPTION_KEY), activeReviewerKey: activeReviewerKey(reviewerId, formId), expiresAt, accessPolicyVersion: reviewer.organization.groupWorkflowsEnabled ? 2 : 1, groupId: reviewer.organization.groupWorkflowsEnabled ? reviewer.groupId : null } });
    await transaction.auditEvent.create({ data: { organizationId, actorId, action: "REVIEW_LINK_ISSUED", entityType: "ReviewLink", entityId: created.id, ...(formId ? { metadata: { formId } } : {}) } });
    return created;
  });
  return { id: link.id, createdAt: link.createdAt, expiresAt: link.expiresAt, canReveal: true, shareUrl: `${env.WEB_ORIGIN}/r/${token}` };
}

reviewLinkRouter.post("/mine/rotate", requireSession, requirePermission("reviewLinks", "manageOwn"), requireCsrf, async (request, response, next) => {
  try {
    const options = issueOptionsSchema.parse(request.body ?? {});
    response.status(201).json({ data: await issueLink(request.auth!.organizationId, request.auth!.userId, request.auth!.membershipId, null, options.expiresInDays) });
  } catch (error) { next(error); }
});

reviewLinkRouter.post("/mine/forms/:formId/rotate", requireSession, requirePermission("reviewLinks", "manageOwn"), requireCsrf, async (request, response, next) => {
  try {
    const options = issueOptionsSchema.parse(request.body ?? {});
    response.status(201).json({ data: await issueLink(request.auth!.organizationId, request.auth!.userId, request.auth!.membershipId, idSchema.parse(request.params.formId), options.expiresInDays) });
  } catch (error) { next(error); }
});

reviewLinkRouter.post("/mine/forms/:formId/reveal", requireSession, requirePermission("reviewLinks", "readOwn"), requireCsrf, async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const auth = request.auth!;
    const formId = idSchema.parse(request.params.formId);
    const link = await prisma.reviewLink.findFirst({
      where: { organizationId: auth.organizationId, reviewerId: auth.membershipId, formId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { reviewer: { select: { role: true, status: true } }, form: { select: { status: true, archivedAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    const eligible = link && canReviewerRevealLink({
      organizationId: link.organizationId,
      reviewerId: link.reviewerId,
      formId: link.formId,
      revokedAt: link.revokedAt,
      expiresAt: link.expiresAt,
      reviewerRole: link.reviewer.role,
      reviewerStatus: link.reviewer.status,
      formStatus: link.form?.status ?? null,
      formArchivedAt: link.form?.archivedAt ?? null,
    }, { organizationId: auth.organizationId, reviewerId: auth.membershipId, formId });
    if (!link || !eligible) throw new HttpError(404, "LINK_NOT_FOUND", "Active form link not found.");
    if (!link.encryptedToken) throw new HttpError(409, "LINK_TOKEN_UNAVAILABLE", "This older link cannot be recovered. Rotate it to create a copyable replacement.");
    const token = decryptSecret(link.encryptedToken, env.TOKEN_ENCRYPTION_KEY);
    await prisma.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "REVIEW_LINK_TOKEN_REVEALED", entityType: "ReviewLink", entityId: link.id, metadata: { formId } } });
    response.json({ data: { shareUrl: `${env.WEB_ORIGIN}/r/${token}` } });
  } catch (error) { next(error); }
});

reviewLinkRouter.post("/:membershipId/rotate", requireSession, requirePermission("reviewLinks", "create"), requireCsrf, async (request, response, next) => {
  try {
    const options = issueOptionsSchema.parse(request.body ?? {});
    response.status(201).json({ data: await issueLink(request.auth!.organizationId, request.auth!.userId, idSchema.parse(request.params.membershipId), null, options.expiresInDays) });
  } catch (error) { next(error); }
});

reviewLinkRouter.post("/:membershipId/forms/:formId/rotate", requireSession, requirePermission("reviewLinks", "create"), requireCsrf, async (request, response, next) => {
  try {
    const options = issueOptionsSchema.parse(request.body ?? {});
    response.status(201).json({ data: await issueLink(request.auth!.organizationId, request.auth!.userId, idSchema.parse(request.params.membershipId), idSchema.parse(request.params.formId), options.expiresInDays) });
  } catch (error) { next(error); }
});

reviewLinkRouter.post("/:linkId/revoke", requireSession, requireCsrf, async (request, response, next) => {
  try {
    const linkId = idSchema.parse(request.params.linkId);
    const auth = request.auth!;
    const link = await prisma.reviewLink.findFirst({ where: { id: linkId, organizationId: auth.organizationId } });
    if (!link) throw new HttpError(404, "LINK_NOT_FOUND", "Review link not found.");
    const permission = authorize({
      role: auth.role,
      organizationId: auth.organizationId,
      requestedOrganizationId: link.organizationId,
      membershipId: auth.membershipId,
      membershipStatus: "ACTIVE",
      resource: "reviewLinks",
      action: auth.role === "REVIEWER" ? "manageOwn" : "archive",
      resourceMembershipId: link.reviewerId,
    });
    if (!permission.allowed) throw new HttpError(403, "FORBIDDEN", "You cannot revoke this review link.");
    if (link.revokedAt) { response.status(204).end(); return; }
    await prisma.$transaction(async (transaction) => {
      await transaction.reviewLink.update({ where: { id: link.id }, data: { revokedAt: new Date(), activeReviewerKey: null } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "REVIEW_LINK_REVOKED", entityType: "ReviewLink", entityId: link.id } });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});

reviewLinkRouter.post("/:linkId/reveal", requireSession, requirePermission("reviewLinks", "read"), requireCsrf, async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const auth = request.auth!;
    const linkId = idSchema.parse(request.params.linkId);
    const link = await prisma.reviewLink.findFirst({
      where: { id: linkId, organizationId: auth.organizationId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { reviewer: { select: { role: true, status: true } }, form: { select: { status: true, archivedAt: true } } },
    });
    if (!link || link.reviewer.role !== "REVIEWER" || link.reviewer.status !== "ACTIVE") throw new HttpError(404, "LINK_NOT_FOUND", "Active reviewer link not found.");
    if (link.formId && (!link.form || link.form.status !== "PUBLISHED" || link.form.archivedAt !== null)) throw new HttpError(409, "FORM_NOT_PUBLISHED", "This form is no longer available for sharing.");
    if (!link.encryptedToken) throw new HttpError(409, "LINK_TOKEN_UNAVAILABLE", "This older link cannot be recovered. Rotate it to create a copyable replacement.");
    const token = decryptSecret(link.encryptedToken, env.TOKEN_ENCRYPTION_KEY);
    await prisma.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "REVIEW_LINK_TOKEN_REVEALED", entityType: "ReviewLink", entityId: link.id, ...(link.formId ? { metadata: { formId: link.formId } } : {}) } });
    response.json({ data: { shareUrl: `${env.WEB_ORIGIN}/r/${token}` } });
  } catch (error) { next(error); }
});
