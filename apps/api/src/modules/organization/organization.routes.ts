import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { defaultWorkspaceTheme, themeSchema } from "./theme.js";

export const organizationRouter = Router();
organizationRouter.get("/", requireSession, async (request, response, next) => {
  try {
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: request.auth!.organizationId }, select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true } });
    response.json({ data: organization });
  } catch (error) { next(error); }
});

organizationRouter.get("/theme", requireSession, async (request, response, next) => {
  try {
    const theme = await prisma.organizationTheme.findUnique({ where: { organizationId: request.auth!.organizationId }, select: { accentColor: true, fontPreset: true, surfacePreset: true, formStyle: true, updatedAt: true } });
    response.json({ data: theme ?? { ...defaultWorkspaceTheme, updatedAt: null } });
  } catch (error) { next(error); }
});

organizationRouter.put("/theme", requireSession, requirePermission("settings", "manage"), requireCsrf, async (request, response, next) => {
  try {
    const input = themeSchema.parse(request.body);
    const auth = request.auth!;
    const theme = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.organizationTheme.upsert({ where: { organizationId: auth.organizationId }, create: { organizationId: auth.organizationId, ...input }, update: input, select: { accentColor: true, fontPreset: true, surfacePreset: true, formStyle: true, updatedAt: true } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "WORKSPACE_THEME_UPDATED", entityType: "Organization", entityId: auth.organizationId, metadata: input } });
      return saved;
    });
    response.json({ data: theme });
  } catch (error) { next(error); }
});

organizationRouter.patch("/", requireSession, requirePermission("workspace", "manage"), requireCsrf, async (request, response, next) => {
  try {
    const { name } = z.object({ name: z.string().trim().min(1).max(160) }).strict().parse(request.body);
    const auth = request.auth!;
    const organization = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.organization.update({ where: { id: auth.organizationId }, data: { name }, select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true } });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "ORGANIZATION_UPDATED", entityType: "Organization", entityId: saved.id, metadata: { name } } });
      return saved;
    });
    response.json({ data: organization });
  } catch (error) { next(error); }
});
