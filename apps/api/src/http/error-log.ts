type ErrorLogRequest = {
  method: string;
  route?: { path?: string };
};

function describeError(error: unknown): { name: string; message: string } {
  // Error messages/stacks can embed request payloads, credentials, or bearer URLs.
  // Keep only the class name; use the request ID to correlate with restricted host logs.
  const name = error instanceof Error && error.name ? error.name : "UnknownError";
  return { name: name.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 100) || "UnknownError", message: "Unhandled server error" };
}

export function formatInternalErrorLog(
  error: unknown,
  request: ErrorLogRequest,
  requestId: string | undefined,
): string {
  return JSON.stringify({
    level: "error",
    event: "http.unhandled_error",
    ...(requestId ? { requestId: requestId.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 200) } : {}),
    method: request.method.replace(/[^A-Za-z]/g, "").slice(0, 20),
    // Express route.path is the registered template, unlike originalUrl or params.
    route: typeof request.route?.path === "string" ? request.route.path.slice(0, 500) : "[unmatched]",
    error: describeError(error),
  });
}
