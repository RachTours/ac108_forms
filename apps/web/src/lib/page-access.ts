import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Role } from "@reviewroom/contracts";
import { sessionResponseSchema } from "@reviewroom/contracts";
import { serverApi } from "./api";
import { homePathForRole, roleMatchesAudience, signInPathForRole } from "./workspace-access";

export async function requireWorkspaceRole(allowedRoles: readonly Role[]) {
  const incomingHeaders = await headers();
  const audience = incomingHeaders.get("x-reviewroom-audience") === "reviewer" ? "reviewer" : "admin";
  const signInPath = signInPathForRole(audience);
  let response: Response;
  try { response = await serverApi("/auth/session"); }
  catch { redirect(`${signInPath}?reason=service-unavailable`); }
  if (!response.ok) redirect(signInPath);
  const session = sessionResponseSchema.safeParse(await response.json());
  if (!session.success) redirect(`${signInPath}?reason=session-invalid`);
  if (!roleMatchesAudience(session.data.role, audience)) redirect(`${signInPath}?reason=wrong-workspace`);
  if (!allowedRoles.includes(session.data.role)) redirect(`${homePathForRole(session.data.role)}?notice=${audience === "admin" ? "admin-only" : "wrong-workspace"}`);
  return session.data;
}
