export function resolveServerApiOrigin(configuredOrigin: string | undefined, nodeEnv: string | undefined): string {
  const origin = configuredOrigin?.trim();
  if (nodeEnv === "production" && !origin) {
    throw new Error("API_INTERNAL_URL must be configured for the production web server.");
  }
  const resolvedOrigin = (origin || "http://localhost:4000").replace(/\/$/, "");
  if (nodeEnv === "production") {
    let parsed: URL;
    try {
      parsed = new URL(resolvedOrigin);
    } catch {
      throw new Error("API_INTERNAL_URL must be a valid URL for the deployed API service.");
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
      throw new Error("API_INTERNAL_URL points to loopback; configure the public HTTPS origin for the separate API service.");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("API_INTERNAL_URL must use HTTPS for the deployed API service.");
    }
  }
  return resolvedOrigin;
}
