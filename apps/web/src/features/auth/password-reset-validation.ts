import { passwordResetRequestSchema } from "@reviewroom/contracts";

export function validatePasswordResetInput(input: unknown) {
  return passwordResetRequestSchema.safeParse(input);
}
