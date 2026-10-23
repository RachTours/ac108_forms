import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { assignmentListSchema, removeAssignmentSchema, setAssignmentSchema } from "./assignment.schemas.js";
import { listAssignments, removeAssignment, setAssignment } from "./assignment.service.js";

export const assignmentRouter = Router();
const idSchema = z.string().uuid();

assignmentRouter.use(requireSession);

assignmentRouter.get("/", requirePermission("assignments", "read"), async (request, response, next) => {
  try {
    const input = assignmentListSchema.parse(request.query);
    const result = await listAssignments(prisma, { organizationId: request.auth!.organizationId, state: input.state, search: input.search, limit: input.limit, ...(input.reviewerId ? { reviewerId: input.reviewerId } : {}), ...(input.cursor ? { cursor: input.cursor } : {}) });
    response.json({ data: result.rows, nextCursor: result.nextCursor, counts: result.counts });
  } catch (error) { next(error); }
});

assignmentRouter.put("/:targetId", requirePermission("assignments", "manage"), requireCsrf, async (request, response, next) => {
  try {
    const targetId = idSchema.parse(request.params.targetId);
    const input = setAssignmentSchema.parse(request.body);
    const auth = request.auth!;
    const result = await prisma.$transaction((transaction) => setAssignment(transaction, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      targetId,
      reviewerId: input.reviewerId,
      expectedUpdatedAt: input.expectedUpdatedAt,
    }));
    response.json({ data: result.assignment, changed: result.changed });
  } catch (error) { next(error); }
});

assignmentRouter.delete("/:targetId", requirePermission("assignments", "manage"), requireCsrf, async (request, response, next) => {
  try {
    const targetId = idSchema.parse(request.params.targetId);
    const input = removeAssignmentSchema.parse(request.body);
    const auth = request.auth!;
    const result = await prisma.$transaction((transaction) => removeAssignment(transaction, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      targetId,
      expectedUpdatedAt: input.expectedUpdatedAt,
    }));
    response.json({ data: result });
  } catch (error) { next(error); }
});
