import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Role } from "@reviewroom/contracts";
import { sessionResponseSchema } from "@reviewroom/contracts";
import { serverApi } from "./api";
import { homePathForRole, roleMatchesAudience, workspaceLoginPath } from "./workspace-access";

export async function requireWorkspaceRole(allowedRoles: readonly Role[]) {
  const incomingHeaders = await headers();
  const audience = incomingHeaders.get("x-reviewroom-audience") === "reviewer" ? "reviewer" : "admin";
  const requestPath = incomingHeaders.get("x-reviewroom-request-path");
  const signInPath = workspaceLoginPath(audience, requestPath);
  let response: Response;
  try { response = await serverApi("/auth/session"); }
  catch { redirect(workspaceLoginPath(audience, requestPath, "service-unavailable")); }
  if (!response.ok) redirect(signInPath);
  const session = sessionResponseSchema.safeParse(await response.json());
  if (!session.success) redirect(workspaceLoginPath(audience, requestPath, "session-invalid"));
  if (!roleMatchesAudience(session.data.role, audience)) redirect(workspaceLoginPath(audience, requestPath, "wrong-workspace"));
  if (!allowedRoles.includes(session.data.role)) redirect(`${homePathForRole(session.data.role)}?notice=${audience === "admin" ? "admin-only" : "wrong-workspace"}`);
  return session.data;
}
