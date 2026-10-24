import type { RequestHandler } from "express";
import type { Role } from "@reviewroom/contracts";
import { HttpError } from "../http/errors.js";

export function requireRole(...allowed: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth || !allowed.includes(request.auth.role)) {
      next(new HttpError(403, "FORBIDDEN", "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}
