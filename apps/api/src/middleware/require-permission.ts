import type { Action, Resource } from "@reviewroom/domain";
import type { RequestHandler } from "express";
import { authorize } from "@reviewroom/domain";
import { HttpError } from "../http/errors.js";

export function requirePermission(resource: Resource, action: Action): RequestHandler {
  return (request, _response, next) => {
    const auth = request.auth;
    if (!auth) {
      next(new HttpError(401, "UNAUTHENTICATED", "Sign in to continue."));
      return;
    }
    // requireSession attaches auth only after reloading and validating an active membership.
    const result = authorize({
      role: auth.role,
      organizationId: auth.organizationId,
      requestedOrganizationId: auth.organizationId,
      membershipId: auth.membershipId,
      membershipStatus: "ACTIVE",
      resource,
      action,
      ...(resource === "reviewWork" ? { resourceMembershipId: auth.membershipId } : {}),
    });
    if (!result.allowed) {
      next(new HttpError(403, "FORBIDDEN", "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}
