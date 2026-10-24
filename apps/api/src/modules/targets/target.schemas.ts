import { z } from "zod";

export const idSchema = z.string().uuid();

export const createTargetSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
}).strict();

export const updateTargetSchema = createTargetSchema
  .partial()
  .refine((value) => value.displayName !== undefined || value.email !== undefined);
