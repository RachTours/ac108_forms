import { createHash, createHmac, randomBytes } from "node:crypto";
import type { CookieOptions, Response } from "express";
import { env } from "../../env.js";

export type SessionAudience = "admin" | "reviewer";

const cookiePrefix = env.NODE_ENV === "production" ? "__Host-reviewroom" : "reviewroom";
export const legacySessionCookieName = cookiePrefix;
export const adminSessionCookieName = `${cookiePrefix}-admin`;
export const reviewerSessionCookieName = `${cookiePrefix}-reviewer`;
export const sessionLifetimeMs = 8 * 60 * 60 * 1000;

export function sessionCookieNameForAudience(audience: SessionAudience): string {
  return audience === "reviewer" ? reviewerSessionCookieName : adminSessionCookieName;
}

export function sessionCookieNameForRequest(
  cookies: Record<string, unknown>,
  audience: SessionAudience,
): string {
  const requestedCookieName = sessionCookieNameForAudience(audience);
  if (cookies[requestedCookieName]) return requestedCookieName;
  if (!hasAudienceSessionCookie(cookies) && cookies[legacySessionCookieName]) return legacySessionCookieName;
  return requestedCookieName;
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createCsrfToken(sessionId: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(sessionId).digest("hex");
}

function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionLifetimeMs,
  };
}

export function setSessionCookie(response: Response, token: string, audience: SessionAudience): void {
  const options = sessionCookieOptions();
  response.cookie(sessionCookieNameForAudience(audience), token, options);
  const { maxAge: _maxAge, ...clearOptions } = options;
  response.clearCookie(legacySessionCookieName, clearOptions);
}

export function clearSessionCookie(response: Response, cookieName: string): void {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  response.clearCookie(cookieName, options);
}

export function hasAudienceSessionCookie(cookies: Record<string, unknown>): boolean {
  return Boolean(cookies[adminSessionCookieName] || cookies[reviewerSessionCookieName]);
}
