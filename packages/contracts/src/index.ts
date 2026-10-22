export * from "./forms";

export const roles = ["OWNER", "ADMIN", "REVIEWER"] as const;
export type Role = (typeof roles)[number];

import { z } from "zod";

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

export const sessionResponseSchema = z.object({
  user: z.object({ id: z.string().uuid(), email: z.string().email(), displayName: z.string() }),
  organizationId: z.string().uuid(),
  organizationName: z.string().min(1),
  membershipId: z.string().uuid(),
  role: z.enum(roles),
  csrfToken: z.string().length(64),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;
