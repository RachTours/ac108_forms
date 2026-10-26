import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { env } from "../../env.js";
import { HttpError } from "../../http/errors.js";
import { authRateLimit } from "../../http/rate-limits.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { hashPassword } from "../auth/password.js";
import { createPasswordResetToken } from "../auth/password-reset.js";
import { decryptSecret, encryptSecret } from "../secrets/secret-box.js";
import { assertMemberCanBePermanentlyDeleted } from "./member-lifecycle.js";
import { InvitationAcceptanceError, parseInvitationAcceptanceInput, resolveInvitationIdentity } from "./invitation-acceptance.js";
import { toMemberSummary } from "./member-summary.js";
import { toMemberUpdateSummary } from "./member-update-summary.js";
import { activeAssignmentWhere, autoAssignUnassignedTargets, lockAssignmentReviewer, removeReviewerAssignments } from "../assignments/assignment.service.js";
import { invitationCreateRequestSchema, memberListResponseSchema, reviewerSettingsRequestSchema } from "@reviewroom/contracts";
import { loadMemberCounts } from "./member-counts.js";

export const memberRouter = Router();
const memberIdSchema = z.string().uuid();
const invitationTokenSchema = z.string().min(40).max(100);
const resetTokenIdSchema = z.string().uuid();

memberRouter.get("/", requireSession, requirePermission("members", "read"), async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const members = await prisma.membership.findMany({
      where: { organizationId },
      select: {
        id: true, organizationId: true, userId: true, role: true, status: true, createdAt: true,
        user: { select: { id: true, email: true, displayName: true, status: true } },
        groupId: true, submissionGoalOverride: true, formAssignmentsConfigured: true,
        reviewerGroup: { select: { id: true, name: true } },
        formAssignments: { select: { formId: true }, orderBy: { formId: "asc" } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200,
    });
    const counts = await loadMemberCounts(prisma, organizationId, members.map(({ id }) => id));
    const body = memberListResponseSchema.parse({
      data: members.map((member) => toMemberSummary({ ...member, _count: counts.get(member.id) ?? { assignments: 0, reviewLinks: 0 } })),
    });
    response.json(body);
  } catch (error) { next(error); }
});

memberRouter.post("/invitations", requireSession, requirePermission("members", "create"), requireCsrf, async (request, response, next) => {
  try {
    const input = invitationCreateRequestSchema.parse(request.body);
    const auth = request.auth!;
    if (input.role === "ADMIN" && auth.role !== "OWNER") throw new HttpError(403, "FORBIDDEN", "Only the owner can invite administrators.");
    const token = randomBytes(32).toString("base64url");
    const invitation = await prisma.$transaction(async (transaction) => {
      const created = await transaction.invitation.create({ data: {
        organizationId: auth.organizationId, role: input.role,
        tokenHash: createHash("sha256").update(token).digest("hex"), encryptedToken: encryptSecret(token, env.TOKEN_ENCRYPTION_KEY), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdById: auth.userId,
      } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "MEMBER_INVITED", entityType: "Invitation", entityId: created.id, metadata: { role: input.role } } });
      return created;
    });
    response.setHeader("Cache-Control", "no-store");
    response.status(201).json({ data: { id: invitation.id, email: invitation.email, displayName: invitation.displayName, role: invitation.role, expiresAt: invitation.expiresAt, createdAt: invitation.createdAt, expired: false, canReveal: true, inviteUrl: `${env.WEB_ORIGIN}/invite/${token}` } });
  } catch (error) { next(error); }
});

memberRouter.get("/invitations", requireSession, requirePermission("members", "read"), async (request, response, next) => {
  try {
    const invitations = await prisma.invitation.findMany({ where: { organizationId: request.auth!.organizationId, acceptedAt: null, revokedAt: null }, select: { id: true, email: true, displayName: true, role: true, expiresAt: true, createdAt: true, encryptedToken: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
    response.json({ data: invitations.map(({ encryptedToken, ...invitation }) => ({ ...invitation, expired: invitation.expiresAt <= new Date(), canReveal: encryptedToken !== null })) });
  } catch (error) { next(error); }
});

memberRouter.post("/invitations/:invitationId/reveal", requireSession, requirePermission("members", "read"), requireCsrf, async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const invitationId = memberIdSchema.parse(request.params.invitationId);
    const auth = request.auth!;
    const invitation = await prisma.invitation.findFirst({ where: { id: invitationId, organizationId: auth.organizationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, role: true, encryptedToken: true } });
    if (!invitation) throw new HttpError(404, "INVITATION_NOT_FOUND", "Active pending invitation not found.");
    if (invitation.role === "ADMIN" && auth.role !== "OWNER") throw new HttpError(403, "FORBIDDEN", "Only the owner can reveal an administrator invitation token.");
    if (!invitation.encryptedToken) throw new HttpError(409, "INVITATION_TOKEN_UNAVAILABLE", "This older invitation token cannot be recovered. Regenerate it to create a copyable link.");
    const token = decryptSecret(invitation.encryptedToken, env.TOKEN_ENCRYPTION_KEY);
    await prisma.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "INVITATION_TOKEN_REVEALED", entityType: "Invitation", entityId: invitation.id } });
    response.json({ data: { inviteUrl: `${env.WEB_ORIGIN}/invite/${token}` } });
  } catch (error) { next(error); }
});

memberRouter.post("/invitations/:invitationId/rotate", requireSession, requirePermission("members", "update"), requireCsrf, async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const invitationId = memberIdSchema.parse(request.params.invitationId);
    const auth = request.auth!;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await prisma.$transaction(async (transaction) => {
      const current = await transaction.invitation.findFirst({ where: { id: invitationId, organizationId: auth.organizationId, acceptedAt: null, revokedAt: null } });
      if (!current) throw new HttpError(404, "INVITATION_NOT_FOUND", "Pending invitation not found.");
      if (current.role === "ADMIN" && auth.role !== "OWNER") throw new HttpError(403, "FORBIDDEN", "Only the owner can rotate an administrator invitation.");
      const replaced = await transaction.invitation.updateMany({
        where: { id: current.id, organizationId: auth.organizationId, tokenHash: current.tokenHash, acceptedAt: null, revokedAt: null },
        data: { tokenHash, encryptedToken: encryptSecret(token, env.TOKEN_ENCRYPTION_KEY), expiresAt },
      });
      if (replaced.count !== 1) throw new HttpError(409, "INVITATION_CHANGED", "This invitation was already accepted or changed. Refresh the page and try again.");
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "INVITATION_ROTATED", entityType: "Invitation", entityId: current.id, metadata: { role: current.role } } });
      return { id: current.id, email: current.email, displayName: current.displayName, role: current.role, createdAt: current.createdAt };
    });
    response.setHeader("Cache-Control", "no-store");
    response.json({ data: { ...invitation, expiresAt, expired: false, canReveal: true, inviteUrl: `${env.WEB_ORIGIN}/invite/${token}` } });
  } catch (error) { next(error); }
});

memberRouter.delete("/invitations/:invitationId", requireSession, requirePermission("members", "archive"), requireCsrf, async (request, response, next) => {
  try {
    const invitationId = memberIdSchema.parse(request.params.invitationId);
    const auth = request.auth!;
    await prisma.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findFirst({ where: { id: invitationId, organizationId: auth.organizationId, acceptedAt: null, revokedAt: null } });
      if (!invitation) throw new HttpError(404, "INVITATION_NOT_FOUND", "Invitation not found.");
      await transaction.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "INVITATION_REVOKED", entityType: "Invitation", entityId: invitation.id } });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});

memberRouter.get("/invitations/:token", authRateLimit, async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const token = invitationTokenSchema.parse(request.params.token);
    const invitation = await prisma.invitation.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") }, select: { email: true, displayName: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true } });
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) throw new HttpError(410, "INVITATION_INVALID", "This invitation is no longer valid.");
    response.json({ data: { email: invitation.email, displayName: invitation.displayName, role: invitation.role, expiresAt: invitation.expiresAt } });
  } catch (error) { next(error); }
});

memberRouter.post("/invitations/:token/accept", authRateLimit, async (request, response, next) => {
  try {
    const token = invitationTokenSchema.parse(request.params.token);
    const input = parseInvitationAcceptanceInput(request.body);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const validInvitation = await prisma.invitation.findUnique({ where: { tokenHash }, select: { acceptedAt: true, revokedAt: true, expiresAt: true } });
    if (!validInvitation || validInvitation.acceptedAt || validInvitation.revokedAt || validInvitation.expiresAt <= new Date()) {
      throw new HttpError(410, "INVITATION_INVALID", "This invitation is no longer valid.");
    }
    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findUnique({ where: { tokenHash } });
      if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) throw new HttpError(410, "INVITATION_INVALID", "This invitation is no longer valid.");
      const claim = await transaction.invitation.updateMany({ where: { id: invitation.id, tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
      if (claim.count !== 1) throw new HttpError(410, "INVITATION_INVALID", "This invitation is no longer valid.");
      let identity: ReturnType<typeof resolveInvitationIdentity>;
      try {
        identity = resolveInvitationIdentity(invitation, input);
      } catch (error) {
        if (error instanceof InvitationAcceptanceError) throw new HttpError(400, error.code, error.message);
        throw error;
      }
      const { email } = identity;
      let user = await transaction.user.findUnique({ where: { email } });
      if (user) {
        if (user.status !== "ACTIVE") throw new HttpError(401, "ACCOUNT_UNAVAILABLE", "This account is not available to join the workspace.");
      } else {
        user = await transaction.user.create({ data: { email, displayName: identity.displayName } });
      }
      const membershipExists = await transaction.membership.findUnique({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } } });
      if (membershipExists) throw new HttpError(409, "ALREADY_MEMBER", "This account already belongs to the workspace.");
      await transaction.membership.create({ data: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role, passwordHash } });
      await transaction.auditEvent.create({ data: { organizationId: invitation.organizationId, actorId: user.id, action: "INVITATION_ACCEPTED", entityType: "Membership", metadata: { role: invitation.role } } });
      if (invitation.role === "REVIEWER") {
        await autoAssignUnassignedTargets(transaction, { organizationId: invitation.organizationId, actorId: user.id, source: "auto-balance-reviewer-accepted" });
      }
    }, { maxWait: 10_000, timeout: 60_000 });
    response.setHeader("Cache-Control", "no-store");
    response.status(201).json({ data: { accepted: true } });
  } catch (error) { next(error); }
});

memberRouter.get("/:membershipId/password-reset-tokens", requireSession, requirePermission("members", "read"), async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const membershipId = memberIdSchema.parse(request.params.membershipId);
    const auth = request.auth!;
    const member = await prisma.membership.findFirst({ where: { id: membershipId, organizationId: auth.organizationId }, select: { id: true, role: true, userId: true } });
    if (!member) throw new HttpError(404, "MEMBER_NOT_FOUND", "Team member not found.");
    if ((member.role === "OWNER" && member.userId !== auth.userId) || (member.role === "ADMIN" && auth.role !== "OWNER")) throw new HttpError(403, "FORBIDDEN", "You cannot manage password recovery for this member.");
    const tokens = await prisma.passwordResetToken.findMany({
      where: { membershipId, organizationId: auth.organizationId },
      select: { id: true, expiresAt: true, createdAt: true, consumedAt: true, revokedAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20,
    });
    response.json({ data: tokens.map((token) => ({ ...token, expired: token.expiresAt <= new Date(), active: token.consumedAt === null && token.revokedAt === null && token.expiresAt > new Date() })) });
  } catch (error) { next(error); }
});

memberRouter.post("/:membershipId/password-reset-tokens", requireSession, requirePermission("members", "update"), requireCsrf, async (request, response, next) => {
  try {
    z.object({}).strict().parse(request.body ?? {});
    const membershipId = memberIdSchema.parse(request.params.membershipId);
    const auth = request.auth!;
    const member = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId: auth.organizationId, status: "ACTIVE", user: { status: "ACTIVE" } },
      select: { id: true, userId: true, role: true },
    });
    if (!member) throw new HttpError(404, "MEMBER_NOT_FOUND", "Active team member not found.");
    if ((member.role === "OWNER" && member.userId !== auth.userId) || (member.role === "ADMIN" && auth.role !== "OWNER")) throw new HttpError(403, "FORBIDDEN", "You cannot issue a reset token for this member.");
    const { token, tokenHash, expiresAt } = createPasswordResetToken();
    const created = await prisma.$transaction(async (transaction) => {
      const now = new Date();
      await transaction.passwordResetToken.updateMany({ where: { membershipId: member.id, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
      const resetToken = await transaction.passwordResetToken.create({ data: {
        organizationId: auth.organizationId, membershipId: member.id, userId: member.userId, tokenHash, expiresAt,
      } });
      await transaction.auditEvent.create({ data: {
        organizationId: auth.organizationId, actorId: auth.userId, action: "PASSWORD_RESET_ISSUED",
        entityType: "Membership", entityId: member.id, metadata: { resetTokenId: resetToken.id, expiresAt: expiresAt.toISOString() },
      } });
      return resetToken;
    });
    response.setHeader("Cache-Control", "no-store");
    response.status(201).json({ data: { id: created.id, token, expiresAt: created.expiresAt, createdAt: created.createdAt } });
  } catch (error) { next(error); }
});

memberRouter.delete("/:membershipId/password-reset-tokens/:resetTokenId", requireSession, requirePermission("members", "archive"), requireCsrf, async (request, response, next) => {
  try {
    const membershipId = memberIdSchema.parse(request.params.membershipId);
    const resetTokenId = resetTokenIdSchema.parse(request.params.resetTokenId);
    const auth = request.auth!;
    const token = await prisma.passwordResetToken.findFirst({ where: { id: resetTokenId, membershipId, organizationId: auth.organizationId, consumedAt: null, revokedAt: null } });
    if (!token) throw new HttpError(404, "PASSWORD_RESET_NOT_FOUND", "Active reset token not found.");
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.update({ where: { id: token.id }, data: { revokedAt: now } });
      await transaction.auditEvent.create({ data: {
        organizationId: auth.organizationId, actorId: auth.userId, action: "PASSWORD_RESET_REVOKED",
        entityType: "Membership", entityId: membershipId, metadata: { resetTokenId },
      } });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});

memberRouter.patch("/:membershipId", requireSession, requirePermission("members", "update"), requireCsrf, async (request, response, next) => {
  try {
    const membershipId = memberIdSchema.parse(request.params.membershipId);
    const input = reviewerSettingsRequestSchema.parse(request.body);
    const auth = request.auth!;
    const updated = await prisma.$transaction(async (transaction) => {
      await lockAssignmentReviewer(transaction, auth.organizationId, membershipId);
      const current = await transaction.membership.findFirst({ where: { id: membershipId, organizationId: auth.organizationId }, include: { user: true } });
      if (!current) throw new HttpError(404, "MEMBER_NOT_FOUND", "Team member not found.");
      if (input.role === "ADMIN" && auth.role !== "OWNER") throw new HttpError(403, "FORBIDDEN", "Only the owner can grant administrator access.");
      if (current.role === "OWNER" && (input.role !== undefined || input.status === "ARCHIVED")) throw new HttpError(409, "OWNER_PROTECTED", "Transfer ownership before changing the owner account.");
      if ((input.groupId !== undefined || input.submissionGoalOverride !== undefined || input.formIds !== undefined) && current.role !== "REVIEWER") throw new HttpError(400, "REVIEWER_SETTINGS_ONLY", "These settings apply to reviewers only.");
      if (input.groupId) {
        const group = await transaction.reviewerGroup.findFirst({ where: { id: input.groupId, organizationId: auth.organizationId }, select: { id: true } });
        if (!group) throw new HttpError(404, "GROUP_NOT_FOUND", "Reviewer group not found.");
      }
      if (input.formIds) {
        const formIds = [...new Set(input.formIds)];
        const forms = await transaction.form.count({ where: { organizationId: auth.organizationId, id: { in: formIds }, status: "PUBLISHED", archivedAt: null, currentPublishedId: { not: null } } });
        if (forms !== formIds.length) throw new HttpError(400, "FORM_ASSIGNMENT_INVALID", "Only published forms in this workspace can be assigned.");
        await transaction.reviewerFormGrant.deleteMany({ where: { organizationId: auth.organizationId, reviewerId: current.id } });
        if (formIds.length) await transaction.reviewerFormGrant.createMany({ data: formIds.map((formId) => ({ organizationId: auth.organizationId, reviewerId: current.id, formId })) });
      }
      if (input.formIds === null) await transaction.reviewerFormGrant.deleteMany({ where: { organizationId: auth.organizationId, reviewerId: current.id } });
      const updateData = {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
        ...(input.submissionGoalOverride !== undefined ? { submissionGoalOverride: input.submissionGoalOverride } : {}),
        ...(input.formIds !== undefined ? { formAssignmentsConfigured: input.formIds !== null } : {}),
      };
      const saved = await transaction.membership.update({ where: { id: current.id }, data: updateData });
      if (input.status === "ARCHIVED" || input.role === "ADMIN") {
        await transaction.session.deleteMany({ where: { membershipId: current.id } });
        if (current.role === "REVIEWER") await removeReviewerAssignments(transaction, { organizationId: auth.organizationId, reviewerId: current.id, actorId: auth.userId, reason: input.status === "ARCHIVED" ? "reviewer-archived" : "reviewer-promoted" });
        await transaction.reviewLink.updateMany({ where: { reviewerId: current.id, revokedAt: null }, data: { revokedAt: new Date(), activeReviewerKey: null } });
      }
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "MEMBER_UPDATED", entityType: "Membership", entityId: current.id, metadata: input } });
      if ((saved.status === "ACTIVE" && saved.role === "REVIEWER" && current.user.status === "ACTIVE") || input.status === "ARCHIVED" || input.role === "ADMIN") {
        await autoAssignUnassignedTargets(transaction, { organizationId: auth.organizationId, actorId: auth.userId, source: "auto-balance-reviewer-updated" });
      }
      return saved;
    }, { maxWait: 10_000, timeout: 60_000 });
    response.json({ data: toMemberUpdateSummary(updated) });
  } catch (error) { next(error); }
});

memberRouter.delete("/:membershipId", requireSession, requirePermission("members", "archive"), requireCsrf, async (request, response, next) => {
  try {
    const membershipId = memberIdSchema.parse(request.params.membershipId);
    const auth = request.auth!;
    await prisma.$transaction(async (transaction) => {
      await lockAssignmentReviewer(transaction, auth.organizationId, membershipId);
      const member = await transaction.membership.findFirst({ where: { id: membershipId, organizationId: auth.organizationId } });
      if (!member) throw new HttpError(404, "MEMBER_NOT_FOUND", "Team member not found.");
      if (member.role === "OWNER") throw new HttpError(409, "OWNER_PROTECTED", "Transfer ownership before removing the owner account.");
      await transaction.membership.update({ where: { id: member.id }, data: { status: "ARCHIVED" } });
      await transaction.session.deleteMany({ where: { membershipId: member.id } });
      if (member.role === "REVIEWER") await removeReviewerAssignments(transaction, { organizationId: auth.organizationId, reviewerId: member.id, actorId: auth.userId, reason: "reviewer-archived" });
      if (member.role === "REVIEWER") await autoAssignUnassignedTargets(transaction, { organizationId: auth.organizationId, actorId: auth.userId, source: "auto-balance-reviewer-removed" });
      await transaction.reviewLink.updateMany({ where: { reviewerId: member.id, revokedAt: null }, data: { revokedAt: new Date(), activeReviewerKey: null } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "MEMBER_ARCHIVED", entityType: "Membership", entityId: member.id } });
    }, { maxWait: 10_000, timeout: 60_000 });
    response.status(204).end();
  } catch (error) { next(error); }
});

memberRouter.delete("/:membershipId/permanent", requireSession, requirePermission("members", "permanentDelete"), requireCsrf, async (request, response, next) => {
  try {
    const membershipId = memberIdSchema.parse(request.params.membershipId);
    const auth = request.auth!;
    await prisma.$transaction(async (transaction) => {
      const member = await transaction.membership.findFirst({ where: { id: membershipId, organizationId: auth.organizationId }, select: { id: true, role: true, status: true } });
      if (!member) throw new HttpError(404, "MEMBER_NOT_FOUND", "Team member not found.");
      const submissionCount = await transaction.submission.count({ where: { organizationId: auth.organizationId, reviewerId: member.id } });
      assertMemberCanBePermanentlyDeleted({ ...member, submissionCount });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "MEMBER_PERMANENTLY_DELETED", entityType: "Membership", entityId: member.id, metadata: { submissionCount } } });
      await transaction.membership.delete({ where: { id: member.id } });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});
