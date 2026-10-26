import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "./errors.js";
import { formatInternalErrorLog } from "./error-log.js";

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "The requested resource was not found.", requestId: response.locals.requestId as string | undefined } });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  const requestId = response.locals.requestId as string | undefined;
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Some submitted values are invalid.", requestId } });
    return;
  }
  if (error instanceof HttpError) {
    if (error.status >= 500) {
      process.stderr.write(`${formatInternalErrorLog(error, request, requestId)}\n`);
      response.status(error.status).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId } });
      return;
    }
    response.status(error.status).json({ error: { code: error.code, message: error.message, requestId, ...(error.fieldId ? { fieldId: error.fieldId } : {}) } });
    return;
  }
  process.stderr.write(`${formatInternalErrorLog(error, request, requestId)}\n`);
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId } });
};
