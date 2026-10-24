import type { RequestHandler } from "express";

export const noStore: RequestHandler = (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  next();
};
