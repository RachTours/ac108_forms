import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { requireSession } from "../../middleware/require-session.js";
import { requireRole } from "../../middleware/require-role.js";

export const auditRouter = Router();
auditRouter.get("/", requireSession, requireRole("OWNER", "ADMIN"), async (request, response, next) => {
  try {
    const cursor = request.query.cursor ? z.string().uuid().parse(request.query.cursor) : undefined;
    const rows = await prisma.auditEvent.findMany({ where: { organizationId: request.auth!.organizationId }, select: { id: true, action: true, entityType: true, entityId: true, createdAt: true, actor: { select: { displayName: true, email: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    const hasMore = rows.length > 50; const data = rows.slice(0, 50);
    response.json({ data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null });
  } catch (error) { next(error); }
});
