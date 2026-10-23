type ErrorLogRequest = {
  method: string;
  baseUrl?: string;
  route?: { path?: string };
};

function describeError(error: unknown): { name: string; message: string } {
  // Error messages/stacks can embed request payloads, credentials, or bearer URLs.
  // Keep only the class name; use the request ID to correlate with restricted host logs.
  const name = error instanceof Error && error.name ? error.name : "UnknownError";
  const safeName = name.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 100) || "UnknownError";
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return {
    name: safeName,
    message: "Unhandled server error",
    ...(safeName === "PrismaClientKnownRequestError" && typeof code === "string" && /^P\d{4}$/.test(code) ? { code } : {}),
  };
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
    // Include the router mount path so nested routes are distinguishable, while
    // avoiding originalUrl and params that may contain secrets or personal data.
    route: typeof request.route?.path === "string"
      ? `${request.baseUrl ?? ""}${request.route.path}`.slice(0, 500)
      : "[unmatched]",
    error: describeError(error),
  });
}
