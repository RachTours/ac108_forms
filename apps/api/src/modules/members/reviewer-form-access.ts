import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { HttpError } from "../../http/errors.js";

type Database = PrismaClient | Prisma.TransactionClient;

// Existing memberships keep legacy access until an admin explicitly saves a list.
export async function reviewerFormScope(db: Database, organizationId: string, reviewerId: string): Promise<Prisma.FormWhereInput> {
  const member = await db.membership.findFirst({ where: { id: reviewerId, organizationId, role: "REVIEWER", status: "ACTIVE" }, select: { formAssignmentsConfigured: true, groupId: true, organization: { select: { groupWorkflowsEnabled: true } }, reviewerGroup: { select: { archivedAt: true } } } });
  if (!member) throw new HttpError(404, "REVIEWER_NOT_FOUND", "Active reviewer not found.");
  if (member.organization?.groupWorkflowsEnabled) return member.groupId && member.reviewerGroup?.archivedAt === null ? { groupFormGrants: { some: { organizationId, groupId: member.groupId } } } : { id: { in: [] } };
  return member.formAssignmentsConfigured ? { reviewerFormGrants: { some: { organizationId, reviewerId } } } : {};
}

export async function assertReviewerFormAccess(db: Database, organizationId: string, reviewerId: string, formId: string) {
  const scope = await reviewerFormScope(db, organizationId, reviewerId);
  const form = await db.form.findFirst({ where: { id: formId, organizationId, status: "PUBLISHED", archivedAt: null, currentPublishedId: { not: null }, ...scope }, select: { id: true } });
  if (!form) throw new HttpError(404, "FORM_NOT_FOUND", "This form is not available to this reviewer.");
}
