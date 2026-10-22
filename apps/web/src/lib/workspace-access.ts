import type { Role } from "@reviewroom/contracts";

export type Audience = "admin" | "reviewer";

export const workspaceNavigation = [
  { href: "/", label: "Overview", roles: ["OWNER", "ADMIN", "REVIEWER"] },
  { href: "/people", label: "Review targets", roles: ["OWNER", "ADMIN"] },
  { href: "/submissions", label: "Submissions", roles: ["OWNER", "ADMIN", "REVIEWER"] },
  { href: "/my-link", label: "My form links", roles: ["REVIEWER"] },
  { href: "/forms", label: "Forms", roles: ["OWNER", "ADMIN"] },
  { href: "/team", label: "Team access", roles: ["OWNER", "ADMIN"] },
  { href: "/settings", label: "Settings", roles: ["OWNER", "ADMIN"] },
] as const;

export function audienceForRole(role: Role): Audience {
  return role === "REVIEWER" ? "reviewer" : "admin";
}

export function signInPathForRole(role: Role | Audience): string {
  return `/${typeof role === "string" && role.toLowerCase() === "reviewer" ? "reviewer" : "admin"}/login`;
}

export function homePathForRole(role: Role): string {
  return role === "REVIEWER" ? "/reviewer/progress" : "/admin/overview";
}

export function workspacePathForRole(path: string, role: Role): string {
  const normalized = path.split("?")[0]?.replace(/\/$/, "") || "/";
  if (role === "REVIEWER") {
    if (normalized === "/") return "/reviewer/progress";
    if (normalized === "/my-link") return "/reviewer/forms";
    if (normalized === "/submissions" || normalized.startsWith("/submissions/")) return normalized.replace(/^\/submissions/, "/reviewer/submissions");
    return normalized.startsWith("/reviewer/") ? normalized : `/reviewer${normalized}`;
  }
  if (normalized === "/") return "/admin/overview";
  if (normalized === "/admin/overview") return normalized;
  if (normalized.startsWith("/admin/")) return normalized;
  return `/admin${normalized}`;
}

export function getNavigationForRole(role: Role) {
  return workspaceNavigation
    .filter((item) => (item.roles as readonly Role[]).includes(role))
    .map((item) => ({ ...item, href: workspacePathForRole(item.href, role) }));
}

function canonicalPath(path: string): string {
  const normalized = (path.split("?")[0] ?? "/").replace(/\/$/, "") || "/";
  if (normalized === "/admin" || normalized === "/admin/overview") return "/";
  if (normalized.startsWith("/admin/")) return normalized.slice("/admin".length) || "/";
  if (normalized === "/reviewer" || normalized === "/reviewer/progress") return "/";
  if (normalized === "/reviewer/forms") return "/my-link";
  if (normalized.startsWith("/reviewer/submissions")) return normalized.slice("/reviewer".length);
  if (normalized.startsWith("/reviewer/")) return normalized.slice("/reviewer".length);
  return normalized;
}

export function canAccessWorkspacePath(path: string, role: Role): boolean {
  const normalized = (path.split("?")[0] ?? "/").replace(/\/$/, "") || "/";
  if (normalized === "/login" || normalized === "/admin/login" || normalized === "/reviewer/login" || normalized === "/reset-password" || normalized.startsWith("/invite/") || normalized.startsWith("/r/")) return true;
  if (normalized.startsWith("/admin") && role === "REVIEWER") return false;
  if (normalized.startsWith("/reviewer") && role !== "REVIEWER") return false;
  const canonical = canonicalPath(normalized);
  return workspaceNavigation.some(({ href, roles }) => {
    if (!(roles as readonly Role[]).includes(role)) return false;
    return canonical === href || (href !== "/" && canonical.startsWith(`${href}/`));
  });
}
