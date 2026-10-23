import type { Audience } from "./workspace-access";

function isPathFamily(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function audienceForRequestPath(pathname: string, resetAudience?: string | null): Audience {
  if (isPathFamily(pathname, "/reset-password")) return resetAudience === "reviewer" ? "reviewer" : "admin";
  if (
    isPathFamily(pathname, "/reviewer") ||
    isPathFamily(pathname, "/my-link") ||
    isPathFamily(pathname, "/r")
  ) return "reviewer";
  return "admin";
}
