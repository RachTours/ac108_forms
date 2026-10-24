type ErrorLogRequest = {
  method: string;
  baseUrl?: string;
  route?: { path?: string };
  originalUrl?: string;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function databaseCode(error: unknown): string | undefined {
  const meta = record(record(error)?.meta);
  const adapter = record(meta?.driverAdapterError);
  const cause = record(adapter?.cause);
  const code = cause?.originalCode ?? cause?.code;
  return typeof code === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(code) ? code : undefined;
}

function sanitizePath(path: string): string {
  return path.split("/").map((segment) => {
    if (!segment) return segment;
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ":id";
    if (segment.length >= 32) return ":token";
    return segment.replace(/[^A-Za-z0-9._~:-]/g, "_").slice(0, 100);
  }).join("/").slice(0, 500);
}

function requestRoute(request: ErrorLogRequest): string {
  if (typeof request.route?.path === "string") {
    const route = `${request.baseUrl ?? ""}${request.route.path}`;
    // A router's root handler is reported as `/`; retain its mount path.
    if (request.baseUrl || request.route.path !== "/") return sanitizePath(route || "/");
  }
  if (typeof request.originalUrl === "string") {
    try { return sanitizePath(new URL(request.originalUrl, "http://internal").pathname); } catch { /* malformed path: use fallback */ }
  }
  return "[unmatched]";
}

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
    ...(safeName === "PrismaClientKnownRequestError" && code === "P2039" && databaseCode(error) ? { databaseCode: databaseCode(error) } : {}),
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
    route: requestRoute(request),
    error: describeError(error),
  });
}
