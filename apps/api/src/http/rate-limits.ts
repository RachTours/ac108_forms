import { createHash } from "node:crypto";
import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

function publicLimitKey(request: Request): string {
  const rawToken = request.params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] ?? "missing" : rawToken ?? "missing";
  return `${ipKeyGenerator(request.ip ?? "unknown")}:${createHash("sha256").update(token).digest("hex")}`;
}

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again shortly." } },
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "AUTH_RATE_LIMITED", message: "Too many sign-in attempts. Try again later." } },
});

export const publicSubmitRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 12,
  keyGenerator: publicLimitKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "SUBMISSION_RATE_LIMITED", message: "Too many submissions. Please try again shortly." } },
});

export const publicReadRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  keyGenerator: publicLimitKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "PUBLIC_READ_RATE_LIMITED", message: "Too many requests. Please try again shortly." } },
});

