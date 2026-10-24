import { z } from "zod";

const invitationEmailSchema = z.string().trim().email().max(254);

export function invitationEmailError(value: string): string | null {
  return invitationEmailSchema.safeParse(value).success
    ? null
    : "Enter a valid email address, such as name@example.com.";
}
