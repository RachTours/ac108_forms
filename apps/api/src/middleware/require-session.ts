import type { RequestHandler } from "express";
import { prisma } from "../db/client.js";
import { HttpError } from "../http/errors.js";
import { createCsrfToken, hashToken, sessionCookieName } from "../modules/auth/session.js";
import { env } from "../env.js";

export const requireSession: RequestHandler = async (request, _response, next) => {
  try {
    const token = request.cookies[sessionCookieName] as string | undefined;
    if (!token || token.length > 128) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true, membership: true, organization: true },
    });
    const now = new Date();
    if (!session || session.expiresAt <= now || session.user.status !== "ACTIVE" || session.membership.status !== "ACTIVE" || session.membership.userId !== session.userId || session.membership.organizationId !== session.organizationId) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
    }
    request.auth = {
      sessionId: session.id,
      userId: session.user.id,
      organizationId: session.organizationId,
      organizationName: session.organization.name,
      membershipId: session.membershipId,
      role: session.membership.role,
      email: session.user.email,
      displayName: session.user.displayName,
    };
    request.csrfToken = createCsrfToken(session.id);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireCsrf: RequestHandler = (request, _response, next) => {
  const supplied = request.get("x-csrf-token");
  const origin = request.get("origin");
  if (!origin || origin !== env.WEB_ORIGIN || !supplied || supplied !== request.csrfToken) {
    next(new HttpError(403, "CSRF_REJECTED", "The request could not be verified."));
    return;
  }
  next();
};
