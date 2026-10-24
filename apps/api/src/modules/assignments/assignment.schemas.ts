import { z } from "zod";

const idSchema = z.string().uuid();
const versionSchema = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const assignmentListSchema = z.object({
  reviewerId: idSchema.optional(),
  state: z.enum(["all", "assigned", "unassigned"]).default("all"),
  search: z.string().trim().max(120).default(""),
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const setAssignmentSchema = z.object({
  reviewerId: idSchema,
  expectedUpdatedAt: versionSchema.nullable(),
}).strict();

export const removeAssignmentSchema = z.object({
  expectedUpdatedAt: versionSchema.nullable(),
}).strict();
