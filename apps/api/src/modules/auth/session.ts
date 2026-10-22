import { createHash, createHmac, randomBytes } from "node:crypto";
import type { CookieOptions } from "express";
import type { Response } from "express";
import { env } from "../../env.js";

export const sessionCookieName = env.NODE_ENV === "production" ? "__Host-reviewroom" : "reviewroom";
export const sessionLifetimeMs = 8 * 60 * 60 * 1000;

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createCsrfToken(sessionId: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(sessionId).digest("hex");
}

export function setSessionCookie(response: Response, token: string): void {
  const options: CookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionLifetimeMs,
  };
  response.cookie(sessionCookieName, token, options);
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
