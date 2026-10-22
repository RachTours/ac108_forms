export function resolveServerApiOrigin(configuredOrigin: string | undefined, nodeEnv: string | undefined): string {
  const origin = configuredOrigin?.trim();
  if (nodeEnv === "production" && !origin) {
    throw new Error("API_INTERNAL_URL must be configured for the production web server.");
  }
  return (origin || "http://localhost:4000").replace(/\/$/, "");
}
