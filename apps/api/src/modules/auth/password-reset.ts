import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "../../http/errors.js";

export const passwordResetLifetimeMs = 30 * 60 * 1000;

export type PasswordResetTokenState = {
  userId: string;
  membershipId: string;
  organizationId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
};

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashPasswordResetToken(token), expiresAt: new Date(now.getTime() + passwordResetLifetimeMs) };
}

export function assertPasswordResetTokenUsable(
  token: PasswordResetTokenState,
  target: { userId: string; membershipId: string; organizationId: string },
  now = new Date(),
): void {
  const usable = token.consumedAt === null
    && token.revokedAt === null
    && token.expiresAt.getTime() > now.getTime()
    && token.userId === target.userId
    && token.membershipId === target.membershipId
    && token.organizationId === target.organizationId;
  if (!usable) throw new HttpError(400, "PASSWORD_RESET_INVALID", "The reset token is invalid or expired.");
}
