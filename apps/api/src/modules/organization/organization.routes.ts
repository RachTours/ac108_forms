import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { resolvePlatformTheme, themeSchema } from "./theme.js";

export const organizationRouter = Router();
organizationRouter.get("/", requireSession, async (request, response, next) => {
  try {
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: request.auth!.organizationId }, select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true } });
    response.json({ data: organization });
  } catch (error) { next(error); }
});

organizationRouter.get("/theme", requireSession, async (request, response, next) => {
  try {
    const platform = z.enum(["admin", "reviewer"]).default(request.auth!.role === "REVIEWER" ? "reviewer" : "admin").parse(request.query.platform);
    const theme = await prisma.organizationTheme.findUnique({ where: { organizationId: request.auth!.organizationId } });
    response.json({ data: { ...resolvePlatformTheme(theme && !request.originalUrl.startsWith("/api/v2/") ? { accentColor: theme.accentColor, fontPreset: theme.fontPreset, surfacePreset: theme.surfacePreset, formStyle: theme.formStyle } : theme, platform), updatedAt: theme?.updatedAt ?? null } });
  } catch (error) { next(error); }
});

organizationRouter.put("/theme", requireSession, requirePermission("settings", "manage"), requireCsrf, async (request, response, next) => {
  try {
    const input = themeSchema.parse(request.body);
    const platform = !request.originalUrl.startsWith("/api/v2/") || request.query.platform === undefined ? undefined : z.enum(["admin", "reviewer"]).parse(request.query.platform);
    const auth = request.auth!;
    const theme = await prisma.$transaction(async (transaction) => {
      const appearance = platform ? platform === "admin" ? { adminAppearance: input } : { reviewerAppearance: input } : input;
      const saved = await transaction.organizationTheme.upsert({ where: { organizationId: auth.organizationId }, create: { organizationId: auth.organizationId, ...appearance }, update: appearance });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "WORKSPACE_THEME_UPDATED", entityType: "Organization", entityId: auth.organizationId, metadata: input } });
      return { ...resolvePlatformTheme(!request.originalUrl.startsWith("/api/v2/") ? { accentColor: saved.accentColor, fontPreset: saved.fontPreset, surfacePreset: saved.surfacePreset, formStyle: saved.formStyle } : saved, platform ?? "admin"), updatedAt: saved.updatedAt };
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
