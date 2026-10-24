import { invitationAcceptRequestSchema } from "@reviewroom/contracts";
import type { z } from "zod";

export type InvitationAcceptanceInput = z.infer<typeof invitationAcceptRequestSchema>;

export class InvitationAcceptanceError extends Error {
  constructor(readonly code: "IDENTITY_REQUIRED" | "INVITATION_EMAIL_MISMATCH") {
    super(code === "IDENTITY_REQUIRED"
      ? "Enter your name and email address to accept this access token."
      : "Use the email address this invitation was issued to.");
    this.name = "InvitationAcceptanceError";
  }
}

export function parseInvitationAcceptanceInput(input: unknown): InvitationAcceptanceInput {
  return invitationAcceptRequestSchema.parse(input);
}

export function resolveInvitationIdentity(
  invitation: { email: string | null; displayName: string | null },
  input: InvitationAcceptanceInput,
): { email: string; displayName: string } {
  const acceptedEmail = invitation.email ?? input.email?.trim() ?? "";
  const acceptedName = invitation.displayName ?? input.displayName?.trim() ?? "";
  if (!acceptedEmail || !acceptedName) throw new InvitationAcceptanceError("IDENTITY_REQUIRED");
  const email = acceptedEmail.toLowerCase();
  if (invitation.email && input.email && invitation.email.toLowerCase() !== input.email.trim().toLowerCase()) {
    throw new InvitationAcceptanceError("INVITATION_EMAIL_MISMATCH");
  }
  return { email, displayName: acceptedName };
}
